import * as vscode from 'vscode'
import type { FileQuery, FileSystemRepository } from '../../domain/repository/file-system.repository'

export class VsCodeFileSystemRepository implements FileSystemRepository {
  public async readText(path: string): Promise<string | null> {
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(path)))
    } catch {
      return null
    }
  }

  public async writeText(path: string, text: string): Promise<void> {
    await this.writeBytes(path, new TextEncoder().encode(text))
  }

  public async readBytes(path: string): Promise<Uint8Array> {
    return vscode.workspace.fs.readFile(vscode.Uri.file(path))
  }

  public async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    await vscode.workspace.fs.writeFile(vscode.Uri.file(path), bytes)
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(path))
      return true
    } catch {
      return false
    }
  }

  public async find(query: FileQuery): Promise<string[]> {
    const include: vscode.RelativePattern = new vscode.RelativePattern(vscode.Uri.file(query.folder), query.include)
    const found: vscode.Uri[] = await vscode.workspace.findFiles(include, query.exclude, query.limit)
    return found.map((uri: vscode.Uri) => uri.fsPath)
  }

  public async modifiedAt(path: string): Promise<number> {
    return (await vscode.workspace.fs.stat(vscode.Uri.file(path))).mtime
  }
}
