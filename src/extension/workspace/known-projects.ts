/**
 * The local folders of the WarpEngine projects ever opened in VS Code, remembered across windows.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Project } from '../../domain/model/project.model'

const KEY = 'warpengine.knownProjects'

/**
 * Remembers, per software name, the folder of the last project opened with that name, in the global state, so the
 * Dashboard can offer to open a catalog entry's project.
 */
export class KnownProjects {
  /**
   * Creates the store.
   *
   * @param memory - The global state that keeps the folders.
   */
  public constructor(private readonly memory: vscode.Memento) {}

  /**
   * Remembers the folders of some projects (writes the global state when something changed).
   *
   * @param projects - The projects of the workspace.
   */
  public async remember(projects: readonly Project[]): Promise<void> {
    const known: Record<string, string> = this.all()
    const next: Record<string, string> = { ...known, ...Object.fromEntries(projects.map((project: Project) => [project.name, project.folder])) }
    if (JSON.stringify(next) !== JSON.stringify(known)) await this.memory.update(KEY, next)
  }

  /**
   * Gives the remembered folder of a software when it still exists.
   *
   * @param name - The software name.
   * @returns The folder, or `null` when none is remembered or it is gone.
   */
  public async folderOf(name: string): Promise<string | null> {
    const folder: string | undefined = this.all()[name]
    if (!folder) return null
    return vscode.workspace.fs.stat(vscode.Uri.file(folder)).then(() => folder, () => null)
  }

  /**
   * Opens the remembered project of a software in this window (`vscode.openFolder`).
   *
   * @param name - The software name.
   * @returns `false` when no existing folder is remembered for it.
   */
  public async open(name: string): Promise<boolean> {
    const folder: string | null = await this.folderOf(name)
    if (!folder) return false
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folder), { forceNewWindow: false })
    return true
  }

  private all(): Record<string, string> {
    return this.memory.get<Record<string, string>>(KEY) ?? {}
  }
}
