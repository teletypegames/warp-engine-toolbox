/**
 * The WarpEngine projects of the workspace folders.
 *
 * @module
 */
import * as vscode from 'vscode'
import { DomainError, msg } from '../../domain/model/message.model'
import type { Project } from '../../domain/model/project.model'
import type { ProjectService } from '../../domain/service/project.service'
import { Dialogs } from '../ui/dialogs'

const WATCHED = '**/{.woodpecker.yaml,.woodpecker.yml,.gitlab-ci.yml,metadata.json,*.lua}'
const DEBOUNCE_MS = 300

/**
 * Knows the WarpEngine projects of the workspace folders and which one is current.
 *
 * It detects them again (debounced) when a pipeline file, `metadata.json` or a `.lua` file
 * changes or the workspace folders change, and keeps the `warpengine.isProject` context key.
 */
export class ProjectRegistry implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  /** Fires after the projects were detected again. */
  public readonly onDidChange: vscode.Event<void> = this.changed.event
  private readonly disposables: vscode.Disposable[] = []
  private projects: Project[] = []
  private timer: NodeJS.Timeout | undefined

  /**
   * Creates the registry and starts the file system watcher; call {@link ProjectRegistry.refresh} for the first detection.
   *
   * @param service - Detects a project in a folder and reads its version.
   */
  public constructor(private readonly service: ProjectService) {
    const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(WATCHED)
    for (const event of [watcher.onDidChange, watcher.onDidCreate, watcher.onDidDelete]) this.disposables.push(event(() => { this.schedule() }))
    this.disposables.push(watcher, vscode.workspace.onDidChangeWorkspaceFolders(() => { this.schedule() }))
  }

  /**
   * Lists the detected projects, one per workspace folder at most.
   *
   * @returns The projects, in workspace folder order.
   */
  public all(): readonly Project[] {
    return this.projects
  }

  /**
   * Finds the current project: the one of the active editor's folder, else the first.
   *
   * @returns The project, or `null` when there is none.
   */
  public current(): Project | null {
    const active: vscode.Uri | undefined = vscode.window.activeTextEditor?.document.uri
    const folder: vscode.WorkspaceFolder | undefined = active ? vscode.workspace.getWorkspaceFolder(active) : undefined
    return this.projects.find((project: Project) => project.folder === folder?.uri.fsPath) ?? this.projects[0] ?? null
  }

  /**
   * Finds the current project like {@link ProjectRegistry.current}, and requires one.
   *
   * @returns The project.
   * @throws {@link domain/model/message.model!DomainError} When the workspace has no WarpEngine project.
   */
  public require(): Project {
    const project: Project | null = this.current()
    if (!project) throw new DomainError(msg('This workspace is no WarpEngine project: it has no pipeline marker (.woodpecker.yaml with platform:).'), 'addToProject')
    return project
  }

  /**
   * Finds the project a `metadata.json` belongs to.
   *
   * @param uri - The file.
   * @returns The project, or `null` when the file is no project's metadata.
   */
  public byMetadata(uri: vscode.Uri): Project | null {
    return this.projects.find((project: Project) => project.isMetadata(uri.fsPath)) ?? null
  }

  /**
   * Finds the workspace folder of a project.
   *
   * @param project - The project.
   * @returns The folder, or `undefined` when it is not open in the workspace.
   */
  public folderOf(project: Project): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(project.folder))
  }

  /**
   * Reads the version a project declares.
   *
   * @param project - The project.
   * @returns The version, or `null` when it declares none.
   */
  public async version(project: Project): Promise<string | null> {
    return this.service.version(project)
  }

  /**
   * Detects the projects of every workspace folder again (a folder that fails is skipped),
   * sets `warpengine.isProject` and fires {@link ProjectRegistry.onDidChange}.
   */
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

  /** Stops the watchers and the pending detection, and releases the event emitter. */
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
