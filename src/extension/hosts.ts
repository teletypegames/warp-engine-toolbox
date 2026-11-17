import * as vscode from 'vscode'
import type { Host } from '../domain/types'
import { WarpEngineClient } from '../infrastructure/warpEngineClient'

export class Hosts implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<Host> = new vscode.EventEmitter<Host>()
  private readonly subscription: vscode.Disposable
  public readonly onDidChange: vscode.Event<Host> = this.changed.event

  public constructor() {
    this.subscription = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (event.affectsConfiguration('warpengine.host') || event.affectsConfiguration('warpengine.hosts')) this.changed.fire(this.current())
    })
  }

  public all(): Host[] {
    const hosts: Host[] = vscode.workspace.getConfiguration('warpengine').get<Host[]>('hosts') ?? []
    return hosts.filter((host: Host) => typeof host.url === 'string' && host.url.length > 0).map((host: Host) => ({ name: host.name, url: normalizeUrl(host.url) }))
  }

  public current(): Host {
    const chosen: string = normalizeUrl(vscode.workspace.getConfiguration('warpengine').get<string>('host') ?? '')
    const hosts: Host[] = this.all()
    return hosts.find((host: Host) => host.url === chosen) ?? hosts[0] ?? (chosen ? { name: chosen, url: chosen } : { name: 'Teletype Games', url: 'https://teletypegames.org' })
  }

  public client(token: string | null = null): WarpEngineClient {
    return new WarpEngineClient(this.current().url, token)
  }

  public async select(): Promise<void> {
    const items: (vscode.QuickPickItem & { url: string | null })[] = [
      ...this.all().map((host: Host) => ({ label: host.name, description: host.url, url: host.url })),
      { label: '$(add) Another host…', url: null }
    ]
    const picked = await vscode.window.showQuickPick(items, { title: 'WarpEngine host', placeHolder: this.current().url })
    if (!picked) return
    let url: string | null = picked.url
    if (url === null) {
      const typed: string | undefined = await vscode.window.showInputBox({ title: 'WarpEngine host URL', placeHolder: 'https://games.example.org', validateInput: validateUrl })
      if (!typed) return
      url = normalizeUrl(typed)
      const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('warpengine')
      const hosts: Host[] = [...this.all(), { name: new URL(url).host, url }]
      await config.update('hosts', hosts, vscode.ConfigurationTarget.Global)
    }
    await vscode.workspace.getConfiguration('warpengine').update('host', url, vscode.ConfigurationTarget.Global)
  }

  public dispose(): void {
    this.subscription.dispose()
    this.changed.dispose()
  }
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function validateUrl(value: string): string | null {
  try {
    const url: URL = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? null : 'An http(s) URL'
  } catch {
    return 'An http(s) URL'
  }
}
