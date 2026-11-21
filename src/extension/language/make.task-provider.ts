/**
 * The `warpengine` task type: the Makefile targets of the projects, run in their dev container when they have one, and the Play and dev image actions.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Project } from '../../domain/model/project.model'
import type { DevContainerService } from '../../domain/service/dev-container.service'
import type { MakeService } from '../../domain/service/make.service'
import { t } from '../ui/l10n'
import type { ProjectRegistry } from '../workspace/project.registry'
import { TaskTerminal, type TaskWork } from './task.terminal'

/** The task type the provider is registered for and its task definitions carry, `warpengine`. */
export const TASK_TYPE = 'warpengine'
const MATCHERS: string[] = ['$warp-acme', '$warp-cc65', '$warp-gcc', '$warp-lua']
const BUILD = 'build'
const PLAY_COMMAND = 'warpengine.play'

/** What a task runs instead of a Makefile target: `play` builds and plays the game, `devImage` builds the dev container image. */
type TaskAction = 'play' | 'devImage'

interface WarpTaskDefinition extends vscode.TaskDefinition {
  readonly target?: string
  readonly ci?: boolean
  readonly host?: boolean
  readonly action?: TaskAction
}

type ExitCallback = ((code: number) => void) | null
type Execution = vscode.ShellExecution | vscode.CustomExecution

/**
 * Offers each Makefile target of each project as a `make <target>` task, with the WarpEngine problem matchers (ACME,
 * cc65, gcc, Lua); `build` is the default build task.
 *
 * A project with a dev container (`.devcontainer/devcontainer.json`) runs its targets in that container: through the
 * Dev Containers CLI from a window on this computer, as they are in a window reopened in the container. Such a project
 * also gets a `dev image` task (builds the container image here); a task with `"host": true` builds in the container
 * first and then runs its target on this computer (a local emulator). A project without one gets, when the platform
 * names a builder image, a `build (CI builder)` task that runs `make build` in that image with docker. Every project
 * gets a `play` task, which runs *Play in the Web Runtime*.
 */
export class MakeTaskProvider implements vscode.TaskProvider {
  /**
   * Creates the provider.
   *
   * @param projects - The projects of the workspace.
   * @param make - Reads a project's Makefile targets.
   * @param devContainers - Tells where a project's commands run and runs them in its dev container.
   */
  public constructor(private readonly projects: ProjectRegistry, private readonly make: MakeService, private readonly devContainers: DevContainerService) {}

  /**
   * Provides the tasks of every project of the workspace, reading their Makefiles and dev containers.
   *
   * @returns The tasks.
   */
  public async provideTasks(): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = []
    for (const project of this.projects.all()) tasks.push(...(await this.projectTasks(project)))
    return tasks
  }

  /**
   * Resolves a `warpengine` task from `tasks.json`: the project of the task's folder, or the current project.
   *
   * @param task - The task with its definition (`target` with optional `ci` and `host`, or `action`).
   * @returns The runnable task, or `undefined` when there is no project or the definition names neither a target nor an action.
   */
  public async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    const project: Project | null = this.projects.all().find((candidate: Project) => this.projects.folderOf(candidate) === task.scope) ?? this.projects.current()
    const definition: WarpTaskDefinition = task.definition
    if (!project || (!definition.target && !definition.action)) return undefined
    return this.task(project, definition, null)
  }

  /**
   * Runs a target as a task in the terminal (in the dev container when the project has one) and waits for it to end.
   *
   * @param project - The project whose Makefile to run.
   * @param target - The make target.
   * @param ci - `true` runs it in the platform's builder image with docker; a project with a dev container runs it there instead.
   * @returns `true` when the target exits with code 0.
   */
  public async run(project: Project, target: string, ci: boolean = false): Promise<boolean> {
    const definition: WarpTaskDefinition = ci ? { type: TASK_TYPE, target, ci } : { type: TASK_TYPE, target }
    return new Promise((resolve: (ok: boolean) => void) => {
      void this.task(project, definition, (code: number) => { resolve(code === 0) }).then(async (task: vscode.Task) => {
        const execution: vscode.TaskExecution = await vscode.tasks.executeTask(task)
        if (task.execution instanceof vscode.CustomExecution) return
        const subscription: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((event: vscode.TaskProcessEndEvent) => {
          if (event.execution !== execution) return
          subscription.dispose()
          resolve(event.exitCode === 0)
        })
      })
    })
  }

  private async projectTasks(project: Project): Promise<vscode.Task[]> {
    const targets: string[] = await this.make.targets(project)
    const contained: boolean = await this.devContainers.has(project.folder)
    const definitions: WarpTaskDefinition[] = targets.map((target: string) => ({ type: TASK_TYPE, target }))
    if (!contained && project.platform?.builder && targets.includes(BUILD)) definitions.push({ type: TASK_TYPE, target: BUILD, ci: true })
    if (contained && !this.devContainers.inside()) definitions.push({ type: TASK_TYPE, action: 'devImage' })
    definitions.push({ type: TASK_TYPE, action: 'play' })
    return Promise.all(definitions.map(async (definition: WarpTaskDefinition) => this.task(project, definition, null)))
  }

  private async task(project: Project, definition: WarpTaskDefinition, onExit: ExitCallback): Promise<vscode.Task> {
    const routed: boolean = await this.devContainers.routes(project.folder)
    const contained: boolean = routed || (this.devContainers.inside() && await this.devContainers.has(project.folder))
    const execution: Execution = this.execution(project, definition, { routed, ci: definition.ci === true && !contained, onExit })
    const scope: vscode.WorkspaceFolder | vscode.TaskScope = this.projects.folderOf(project) ?? vscode.TaskScope.Workspace
    const task: vscode.Task = new vscode.Task(definition, scope, MakeTaskProvider.name(definition, contained), TASK_TYPE, execution, MATCHERS)
    if (definition.target === BUILD && !definition.ci && !definition.host) task.group = vscode.TaskGroup.Build
    return task
  }

  private execution(project: Project, definition: WarpTaskDefinition, how: { routed: boolean; ci: boolean; onExit: ExitCallback }): Execution {
    if (definition.action === 'play') return MakeTaskProvider.custom(async () => MakeTaskProvider.play(), how.onExit)
    if (definition.action === 'devImage') return MakeTaskProvider.custom(async (output) => this.buildImage(project, output), how.onExit)
    const target: string = definition.target ?? BUILD
    if (how.ci) return MakeTaskProvider.ciExecution(project, target)
    if (definition.host && how.routed) return MakeTaskProvider.custom(async (output) => this.buildThenHost(project, target, output), how.onExit)
    if (how.routed) return MakeTaskProvider.custom(async (output) => this.devContainers.run(project.folder, ['make', target], output), how.onExit)
    return MakeTaskProvider.make(project, target)
  }

  private async buildImage(project: Project, output: (text: string) => void): Promise<number> {
    if (this.devContainers.inside()) {
      output(`${t('This window runs in the dev container already; its image is built.')}\n`)
      return 0
    }
    return this.devContainers.buildImage(project.folder, output)
  }

  private async buildThenHost(project: Project, target: string, output: (text: string) => void): Promise<number> {
    const built: number = await this.devContainers.run(project.folder, ['make', BUILD], output)
    if (built !== 0) return built
    output(`${t('Built in the dev container; running make {0} on this computer.', target)}\n`)
    await vscode.tasks.executeTask(new vscode.Task({ type: TASK_TYPE, target }, this.projects.folderOf(project) ?? vscode.TaskScope.Workspace, t('{0} (this computer)', target), TASK_TYPE, MakeTaskProvider.make(project, target), MATCHERS))
    return 0
  }

  private static async play(): Promise<number> {
    await vscode.commands.executeCommand(PLAY_COMMAND)
    return 0
  }

  private static name(definition: WarpTaskDefinition, contained: boolean): string {
    if (definition.action === 'play') return t('play')
    if (definition.action === 'devImage') return t('dev image')
    const target: string = definition.target ?? BUILD
    if (definition.ci && !contained) return `${target} (CI builder)`
    return definition.host ? t('{0} (this computer)', target) : target
  }

  private static custom(work: TaskWork, onExit: ExitCallback): vscode.CustomExecution {
    return new vscode.CustomExecution(() => Promise.resolve(new TaskTerminal(work, onExit)))
  }

  private static make(project: Project, target: string): vscode.ShellExecution {
    return new vscode.ShellExecution('make', [target], { cwd: project.folder })
  }

  private static ciExecution(project: Project, target: string): vscode.ShellExecution {
    const docker: string = vscode.workspace.getConfiguration('warpengine').get<string>('docker') ?? 'docker'
    return new vscode.ShellExecution(docker, ['run', '--rm', '--platform', 'linux/amd64', '-v', `${project.folder}:/src`, '-w', '/src', project.platform?.builder ?? '', 'make', target])
  }
}
