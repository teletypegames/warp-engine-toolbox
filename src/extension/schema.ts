import * as vscode from 'vscode'
import type { Hosts } from './hosts'
import type { Projects } from './project'

export const SCHEMA_SCHEME = 'warpengine-schema'
const EMPTY: string = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' })

export class SchemaProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>()
  public readonly onDidChange: vscode.Event<vscode.Uri> = this.changed.event
  private readonly cache = new Map<string, string>()
  private readonly disposables: vscode.Disposable[]

  public constructor(private readonly hosts: Hosts, private readonly projects: Projects) {
    const fire = (): void => { this.changed.fire(vscode.Uri.parse(`${SCHEMA_SCHEME}://current/metadata.schema.json`)) }
    this.disposables = [
      vscode.workspace.registerTextDocumentContentProvider(SCHEMA_SCHEME, this),
      projects.onDidChange(fire),
      hosts.onDidChange(() => { this.cache.clear(); fire() })
    ]
  }

  public async provideTextDocumentContent(): Promise<string> {
    const platform: string | undefined = this.projects.current()?.platformName
    if (!platform) return EMPTY
    return this.schema(platform)
  }

  public async schema(platform: string): Promise<string> {
    const host = this.hosts.current()
    if (!host) return EMPTY
    const key = `${host.url}#${platform}`
    const cached: string | undefined = this.cache.get(key)
    if (cached) return cached
    try {
      const text: string = JSON.stringify(await this.hosts.client().metadataSchema(platform))
      this.cache.set(key, text)
      return text
    } catch {
      return EMPTY
    }
  }

  public dispose(): void {
    for (const disposable of this.disposables) disposable.dispose()
    this.changed.dispose()
  }
}
