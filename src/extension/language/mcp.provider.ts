/**
 * The MCP server definition of the current WarpEngine host.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { HostService } from '../../domain/service/host.service'

/** Offers the current host's admin MCP endpoint (`/api/admin/v2/mcp`) to VS Code's MCP clients, with the signed-in token. */
export class McpProvider implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition>, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  /** Fires when the definitions may have changed; see {@link McpProvider.announce}. */
  public readonly onDidChangeMcpServerDefinitions: vscode.Event<void> = this.changed.event

  /**
   * Creates the provider.
   *
   * @param hosts - Tells the current host.
   * @param connection - Gives the token of the current host.
   */
  public constructor(private readonly hosts: HostService, private readonly connection: ConnectionService) {}

  /**
   * Provides one HTTP server, `WarpEngine (<host name>)`, at `<host>/api/admin/v2/mcp` with an
   * `Authorization: Bearer` header; does not prompt to sign in.
   *
   * @returns The definition, or none when no host is set or there is no session.
   */
  public async provideMcpServerDefinitions(): Promise<vscode.McpHttpServerDefinition[]> {
    const host: Host | null = this.hosts.current()
    if (!host) return []
    const token: string | null = await this.connection.token(false)
    if (!token) return []
    return [new vscode.McpHttpServerDefinition(`WarpEngine (${host.name})`, vscode.Uri.parse(`${host.url}/api/admin/v2/mcp`), { Authorization: `Bearer ${token}` })]
  }

  /** Tells VS Code to ask for the definitions again, after the host or the session changed. */
  public announce(): void {
    this.changed.fire()
  }

  /** Releases the event emitter. */
  public dispose(): void {
    this.changed.dispose()
  }
}
