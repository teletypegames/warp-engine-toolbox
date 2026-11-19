/**
 * The {@link domain/repository/file-system.repository!FileSystemRepository} port implemented with the VS Code workspace file system.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { FileQuery, FileSystemRepository } from '../../domain/repository/file-system.repository'

/**
 * Reads and writes files by absolute path through `vscode.workspace.fs`, and searches
 * with `vscode.workspace.findFiles`.
 */
export class VsCodeFileSystemRepository implements FileSystemRepository {
  /**
   * Reads a file as UTF-8 text.
   *
   * @param path - The absolute path.
   * @returns The text, or `null` when the file cannot be read.
   */
  public async readText(path: string): Promise<string | null> {
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(path)))
    } catch {
      return null
    }
  }

  /**
   * Writes text to a file as UTF-8, creating or replacing it.
   *
   * @param path - The absolute path.
   * @param text - The content.
   * @throws When VS Code cannot write the file.
   */
  public async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, new TextEncoder().encode(text))
  }

  /**
   * Reads a file's bytes.
   *
   * @param path - The absolute path.
   * @returns The content.
   * @throws When the file cannot be read.
   */
  public async readBytes(path: string): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(vscode.Uri.file(path))
  }

  /**
   * Writes bytes to a file, creating or replacing it.
   *
   * @param path - The absolute path.
   * @param bytes - The content.
   * @throws When VS Code cannot write the file.
   */
  public async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    await vscode.workspace.fs.writeFile(vscode.Uri.file(path), bytes)
  }

  /**
   * Tells whether a file or folder exists.
   *
   * @param path - The absolute path.
   * @returns `true` when VS Code can stat it.
   */
  public async exists(path: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(path))
      return true
    } catch {
      return false
    }
  }

  /**
   * Finds files in a folder by glob, honouring the workspace's `files.exclude`.
   *
   * @param query - The folder, the include and exclude globs, and the most results to return.
   * @returns The absolute paths of the files found.
   */
  public async find(query: FileQuery): Promise<string[]> {
    const include: vscode.RelativePattern = new vscode.RelativePattern(vscode.Uri.file(query.folder), query.include)
    const found: vscode.Uri[] = await vscode.workspace.findFiles(include, query.exclude, query.limit)
    return found.map((uri: vscode.Uri) => uri.fsPath)
  }

  /**
   * Reads when a file was last modified.
   *
   * @param path - The absolute path.
   * @returns The modification time in milliseconds since the epoch.
   * @throws When the file does not exist.
   */
  public async modifiedAt(path: string): Promise<number> {
    return (await vscode.workspace.fs.stat(vscode.Uri.file(path))).mtime
  }
}
