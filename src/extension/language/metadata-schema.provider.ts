import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { HostService } from '../../domain/service/host.service'
import type { ProjectRegistry } from '../workspace/project.registry'

export const SCHEMA_SCHEME = 'warpengine-schema'
const CURRENT = `${SCHEMA_SCHEME}://current/metadata.schema.json`
const EMPTY: string = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' })

export class MetadataSchemaProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>()
  public readonly onDidChange: vscode.Event<vscode.Uri> = this.changed.event
  private readonly cache: Map<string, string> = new Map<string, string>()
  private readonly registration: vscode.Disposable = vscode.workspace.registerTextDocumentContentProvider(SCHEMA_SCHEME, this)

  public constructor(private readonly hosts: HostService, private readonly connection: ConnectionService, private readonly projects: ProjectRegistry) {}

  public async provideTextDocumentContent(): Promise<string> {
    const platform: string | undefined = this.projects.current()?.platformName
    return platform ? this.schema(platform) : EMPTY
  }

  public async schema(platform: string): Promise<string> {
    const host: Host | null = this.hosts.current()
    if (!host) return EMPTY
    const key = `${host.url}#${platform}`
    const cached: string | undefined = this.cache.get(key)
    if (cached) return cached
    try {
      const text: string = JSON.stringify(await this.connection.build().metadataSchema(platform))
      this.cache.set(key, text)
      return text
    } catch {
      return EMPTY
    }
  }

  public announce(): void {
    this.changed.fire(vscode.Uri.parse(CURRENT))
  }

  public forgetHost(): void {
    this.cache.clear()
    this.announce()
  }

  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
  }
}
