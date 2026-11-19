/**
 * The `warpengine` task type: the Makefile targets of the projects.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Project } from '../../domain/model/project.model'
import type { MakeService } from '../../domain/service/make.service'
import type { ProjectRegistry } from '../workspace/project.registry'

/** The task type the provider is registered for and its task definitions carry, `warpengine`. */
export const TASK_TYPE = 'warpengine'
const MATCHERS: string[] = ['$warp-acme', '$warp-cc65', '$warp-gcc', '$warp-lua']
const BUILD = 'build'

interface WarpTaskDefinition extends vscode.TaskDefinition {
  readonly target: string
  readonly ci?: boolean
}

/**
 * Offers each Makefile target of each project as a `make <target>` task, with the
 * WarpEngine problem matchers (ACME, cc65, gcc, Lua). `build` is the default build task;
 * when the platform names a builder image, a `build (CI builder)` task runs `make build`
 * in that image with docker (`linux/amd64`, the project mounted at `/src`).
 */
export class MakeTaskProvider implements vscode.TaskProvider {
  /**
   * Creates the provider.
   *
   * @param projects - The projects of the workspace.
   * @param make - Reads a project's Makefile targets.
   */
  public constructor(private readonly projects: ProjectRegistry, private readonly make: MakeService) {}

  /**
   * Provides the tasks of every project of the workspace, reading their Makefiles.
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
   * @param task - The task with its definition (`target`, optional `ci`).
   * @returns The runnable task, or `undefined` when there is no project.
   */
  public resolveTask(task: vscode.Task): vscode.Task | undefined {
    const project: Project | null = this.projects.all().find((candidate: Project) => this.projects.folderOf(candidate) === task.scope) ?? this.projects.current()
    return project ? this.task(project, task.definition as WarpTaskDefinition) : undefined
  }

  /**
   * Runs a target as a task in the terminal and waits for its process to end.
   *
   * @param project - The project whose Makefile to run.
   * @param target - The make target.
   * @param ci - `true` runs it in the platform's builder image with docker.
   * @returns `true` when the process exits with code 0.
   */
  public async run(project: Project, target: string, ci: boolean = false): Promise<boolean> {
    const definition: WarpTaskDefinition = ci ? { type: TASK_TYPE, target, ci } : { type: TASK_TYPE, target }
    const execution: vscode.TaskExecution = await vscode.tasks.executeTask(this.task(project, definition))
    return new Promise((resolve: (ok: boolean) => void) => {
      const subscription: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((event: vscode.TaskProcessEndEvent) => {
        if (event.execution !== execution) return
        subscription.dispose()
        resolve(event.exitCode === 0)
      })
    })
  }

  private async projectTasks(project: Project): Promise<vscode.Task[]> {
    const targets: string[] = await this.make.targets(project)
    const tasks: vscode.Task[] = targets.map((target: string) => this.task(project, { type: TASK_TYPE, target }))
    if (project.platform?.builder && targets.includes(BUILD)) tasks.push(this.task(project, { type: TASK_TYPE, target: BUILD, ci: true }))
    return tasks
  }

  private task(project: Project, definition: WarpTaskDefinition): vscode.Task {
    const execution: vscode.ShellExecution = definition.ci ? MakeTaskProvider.ciExecution(project, definition.target) : new vscode.ShellExecution('make', [definition.target], { cwd: project.folder })
    const name: string = definition.ci ? `${definition.target} (CI builder)` : definition.target
    const scope: vscode.WorkspaceFolder | vscode.TaskScope = this.projects.folderOf(project) ?? vscode.TaskScope.Workspace
    const task: vscode.Task = new vscode.Task(definition, scope, name, 'warpengine', execution, MATCHERS)
    if (definition.target === BUILD && !definition.ci) task.group = vscode.TaskGroup.Build
    return task
  }

  private static ciExecution(project: Project, target: string): vscode.ShellExecution {
    const docker: string = vscode.workspace.getConfiguration('warpengine').get<string>('docker') ?? 'docker'
    return new vscode.ShellExecution(docker, ['run', '--rm', '--platform', 'linux/amd64', '-v', `${project.folder}:/src`, '-w', '/src', project.platform?.builder ?? '', 'make', target])
  }
}
