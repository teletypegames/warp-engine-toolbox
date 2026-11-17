import * as vscode from 'vscode'
import { DomainError, msg } from '../../domain/model/message.model'
import type { Project } from '../../domain/model/project.model'
import type { ProjectService } from '../../domain/service/project.service'
import { Dialogs } from '../ui/dialogs'

const WATCHED = '**/{.woodpecker.yaml,.woodpecker.yml,.gitlab-ci.yml,metadata.json,*.lua}'
const DEBOUNCE_MS = 300

export class ProjectRegistry implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChange: vscode.Event<void> = this.changed.event
  private readonly disposables: vscode.Disposable[] = []
  private projects: Project[] = []
  private timer: NodeJS.Timeout | undefined

  public constructor(private readonly service: ProjectService) {
    const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(WATCHED)
    for (const event of [watcher.onDidChange, watcher.onDidCreate, watcher.onDidDelete]) this.disposables.push(event(() => { this.schedule() }))
    this.disposables.push(watcher, vscode.workspace.onDidChangeWorkspaceFolders(() => { this.schedule() }))
  }

  public all(): readonly Project[] {
    return this.projects
  }

  public current(): Project | null {
    const active: vscode.Uri | undefined = vscode.window.activeTextEditor?.document.uri
    const folder: vscode.WorkspaceFolder | undefined = active ? vscode.workspace.getWorkspaceFolder(active) : undefined
    return this.projects.find((project: Project) => project.folder === folder?.uri.fsPath) ?? this.projects[0] ?? null
  }

  public require(): Project {
    const project: Project | null = this.current()
    if (!project) throw new DomainError(msg('This workspace is no WarpEngine project: it has no pipeline marker (.woodpecker.yaml with platform:).'))
    return project
  }

  public byMetadata(uri: vscode.Uri): Project | null {
    return this.projects.find((project: Project) => project.isMetadata(uri.fsPath)) ?? null
  }

  public folderOf(project: Project): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(project.folder))
  }

  public async version(project: Project): Promise<string | null> {
    return this.service.version(project)
  }

  public async refresh(): Promise<void> {
    const found: Project[] = []
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const project: Project | null = await this.service.detect({ path: folder.uri.fsPath, name: folder.name }).catch(() => null)
      if (project) found.push(project)
    }
    this.projects = found
    await Dialogs.setContext('warpengine.isProject', found.length > 0)
    this.changed.fire()
  }

  public dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    for (const disposable of this.disposables) disposable.dispose()
    this.changed.dispose()
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.refresh() }, DEBOUNCE_MS)
  }
}
