import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { HostService } from '../../domain/service/host.service'

export class McpProvider implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition>, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChangeMcpServerDefinitions: vscode.Event<void> = this.changed.event

  public constructor(private readonly hosts: HostService, private readonly connection: ConnectionService) {}

  public async provideMcpServerDefinitions(): Promise<vscode.McpHttpServerDefinition[]> {
    const host: Host | null = this.hosts.current()
    if (!host) return []
    const token: string | null = await this.connection.token(false)
    if (!token) return []
    return [new vscode.McpHttpServerDefinition(`WarpEngine (${host.name})`, vscode.Uri.parse(`${host.url}/api/admin/v1/mcp`), { Authorization: `Bearer ${token}` })]
  }

  public announce(): void {
    this.changed.fire()
  }

  public dispose(): void {
    this.changed.dispose()
  }
}
