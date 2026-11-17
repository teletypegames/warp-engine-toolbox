import * as vscode from 'vscode'
import type { WarpEngineAuth } from './auth'
import type { Hosts } from './hosts'

export function registerMcp(hosts: Hosts, auth: WarpEngineAuth): { dispose(): unknown }[] {
  const changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  const provider: vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition> = {
    onDidChangeMcpServerDefinitions: changed.event,
    async provideMcpServerDefinitions(): Promise<vscode.McpHttpServerDefinition[]> {
      const host = hosts.current()
      if (!host) return []
      const token: string | null = await auth.token(false)
      if (!token) return []
      return [new vscode.McpHttpServerDefinition(`WarpEngine (${host.name})`, vscode.Uri.parse(`${host.url}/api/admin/v1/mcp`), { Authorization: `Bearer ${token}` })]
    }
  }
  return [
    changed,
    vscode.lm.registerMcpServerDefinitionProvider('warpengine', provider),
    auth.onDidChangeSessions(() => { changed.fire() }),
    hosts.onDidChange(() => { changed.fire() })
  ]
}
