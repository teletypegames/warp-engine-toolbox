import * as vscode from 'vscode'
import { luaFileFromCommand, luaHeaderValues } from '../domain/luaHeader'
import { isMarker, parseMarker, type Marker } from '../domain/marker'
import type { PlatformDescription } from '../domain/types'
import { shell } from '../infrastructure/process'
import type { Platforms } from './platforms'

export const MARKER_FILES: readonly string[] = ['.woodpecker.yaml', '.woodpecker.yml', '.gitlab-ci.yml']

export interface Project {
  readonly folder: vscode.WorkspaceFolder
  readonly markerUri: vscode.Uri
  readonly marker: Marker
  readonly platformName: string
  readonly platform: PlatformDescription | null
  readonly metadataUri: vscode.Uri | null
  readonly metadataFormat: 'json' | 'lua' | 'custom'
  readonly metadata: Record<string, unknown>
  readonly name: string
}

export class Projects implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChange: vscode.Event<void> = this.changed.event
  private readonly disposables: vscode.Disposable[] = []
  private projects: Project[] = []
  private timer: NodeJS.Timeout | undefined

  public constructor(private readonly platforms: Platforms) {
    const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/{.woodpecker.yaml,.woodpecker.yml,.gitlab-ci.yml,metadata.json,*.lua}')
    for (const event of [watcher.onDidChange, watcher.onDidCreate, watcher.onDidDelete]) this.disposables.push(event(() => { this.schedule() }))
    this.disposables.push(watcher, vscode.workspace.onDidChangeWorkspaceFolders(() => { this.schedule() }))
  }

  public all(): readonly Project[] {
    return this.projects
  }

  public current(): Project | null {
    const active: vscode.Uri | undefined = vscode.window.activeTextEditor?.document.uri
    const folder: vscode.WorkspaceFolder | undefined = active ? vscode.workspace.getWorkspaceFolder(active) : undefined
    return this.projects.find((project: Project) => project.folder === folder) ?? this.projects[0] ?? null
  }

  public require(): Project {
    const project: Project | null = this.current()
    if (!project) throw new Error('This workspace is no WarpEngine project: it has no pipeline marker (.woodpecker.yaml with platform:).')
    return project
  }

  public async refresh(): Promise<void> {
    const found: Project[] = []
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const project: Project | null = await this.detect(folder).catch(() => null)
      if (project) found.push(project)
    }
    this.projects = found
    await vscode.commands.executeCommand('setContext', 'warpengine.isProject', found.length > 0)
    this.changed.fire()
  }

  public async version(project: Project): Promise<string | null> {
    const fromMetadata: unknown = project.metadata['version']
    if (project.platform?.version.source !== 'command') return typeof fromMetadata === 'string' ? fromMetadata : null
    const command: string | null = project.platform.version.command
    if (!command) return null
    const result = await shell(command, project.folder.uri.fsPath)
    return result.code === 0 && result.stdout.trim() ? result.stdout.trim() : null
  }

  public dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    for (const disposable of this.disposables) disposable.dispose()
    this.changed.dispose()
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.refresh() }, 300)
  }

  private async detect(folder: vscode.WorkspaceFolder): Promise<Project | null> {
    for (const file of MARKER_FILES) {
      const uri: vscode.Uri = vscode.Uri.joinPath(folder.uri, file)
      const text: string | null = await readText(uri)
      if (text === null || !isMarker(text)) continue
      const marker: Marker = parseMarker(text)
      const platformName: string = marker.platform ?? ''
      const platform: PlatformDescription | null = await this.platforms.find(platformName).catch(() => null)
      const { metadataUri, metadata, format } = await readMetadata(folder, platform)
      const name: string = marker.name ?? (typeof metadata['name'] === 'string' ? metadata['name'] : folder.name)
      return { folder, markerUri: uri, marker, platformName, platform, metadataUri, metadataFormat: format, metadata, name }
    }
    return null
  }
}

async function readMetadata(folder: vscode.WorkspaceFolder, platform: PlatformDescription | null): Promise<{ metadataUri: vscode.Uri | null; metadata: Record<string, unknown>; format: 'json' | 'lua' | 'custom' }> {
  const format: 'json' | 'lua' | 'custom' = platform?.metadata.format ?? 'json'
  if (format === 'json') {
    const uri: vscode.Uri = vscode.Uri.joinPath(folder.uri, platform?.metadata.file ?? 'metadata.json')
    const text: string | null = await readText(uri)
    if (text === null) return { metadataUri: uri, metadata: {}, format }
    try {
      const parsed: unknown = JSON.parse(text)
      return { metadataUri: uri, metadata: parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}, format }
    } catch {
      return { metadataUri: uri, metadata: {}, format }
    }
  }
  if (format === 'lua') {
    const file: string | null = luaFileFromCommand(platform?.version.command ?? null)
    const candidates: vscode.Uri[] = file ? [vscode.Uri.joinPath(folder.uri, file)] : await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '*.lua'), null, 20)
    for (const uri of candidates) {
      const text: string | null = await readText(uri)
      if (text?.startsWith('--')) return { metadataUri: uri, metadata: luaHeaderValues(text), format }
    }
    return { metadataUri: candidates[0] ?? null, metadata: {}, format }
  }
  return { metadataUri: null, metadata: {}, format }
}

export async function readText(uri: vscode.Uri): Promise<string | null> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))
  } catch {
    return null
  }
}

export async function writeText(uri: vscode.Uri, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text))
}
