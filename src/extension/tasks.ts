import * as vscode from 'vscode'
import { readText, type Project, type Projects } from './project'

export const TASK_TYPE = 'warpengine'
const MATCHERS: string[] = ['$warp-acme', '$warp-cc65', '$warp-gcc', '$warp-lua']
const TARGET = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)/

interface WarpTaskDefinition extends vscode.TaskDefinition {
  readonly target: string
  readonly ci?: boolean
}

export class WarpTasks implements vscode.TaskProvider {
  public constructor(private readonly projects: Projects) {}

  public async provideTasks(): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = []
    for (const project of this.projects.all()) {
      const targets: string[] = await makeTargets(project)
      for (const target of targets) tasks.push(this.task(project, { type: TASK_TYPE, target }))
      if (project.platform?.ci.builder && targets.includes('build')) tasks.push(this.task(project, { type: TASK_TYPE, target: 'build', ci: true }))
    }
    return tasks
  }

  public resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition: WarpTaskDefinition = task.definition as WarpTaskDefinition
    const project: Project | undefined = this.projects.all().find((candidate: Project) => candidate.folder === task.scope) ?? this.projects.current() ?? undefined
    return project ? this.task(project, definition) : undefined
  }

  public task(project: Project, definition: WarpTaskDefinition): vscode.Task {
    const execution: vscode.ShellExecution = definition.ci
      ? ciExecution(project, definition.target)
      : new vscode.ShellExecution('make', [definition.target], { cwd: project.folder.uri.fsPath })
    const name: string = definition.ci ? `${definition.target} (CI builder)` : definition.target
    const task: vscode.Task = new vscode.Task(definition, project.folder, name, 'warpengine', execution, MATCHERS)
    if (definition.target === 'build' && !definition.ci) task.group = vscode.TaskGroup.Build
    return task
  }
}

function ciExecution(project: Project, target: string): vscode.ShellExecution {
  const docker: string = vscode.workspace.getConfiguration('warpengine').get<string>('docker') ?? 'docker'
  const image: string = project.platform?.ci.builder ?? ''
  return new vscode.ShellExecution(docker, [
    'run', '--rm', '--platform', 'linux/amd64', '-v', `${project.folder.uri.fsPath}:/src`, '-w', '/src', image, 'make', target
  ])
}

export async function makeTargets(project: Project): Promise<string[]> {
  const text: string | null = await readText(vscode.Uri.joinPath(project.folder.uri, 'Makefile'))
  if (text === null) return []
  const targets = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const match: RegExpExecArray | null = TARGET.exec(line)
    if (match?.[1] && !match[1].startsWith('.') && !match[1].includes('%') && !match[1].includes('$')) targets.add(match[1])
  }
  return [...targets]
}

export async function runTarget(provider: WarpTasks, project: Project, target: string, ci: boolean = false): Promise<boolean> {
  const execution: vscode.TaskExecution = await vscode.tasks.executeTask(provider.task(project, ci ? { type: TASK_TYPE, target, ci } : { type: TASK_TYPE, target }))
  return new Promise((resolve: (ok: boolean) => void) => {
    const subscription: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((event: vscode.TaskProcessEndEvent) => {
      if (event.execution !== execution) return
      subscription.dispose()
      resolve(event.exitCode === 0)
    })
  })
}
