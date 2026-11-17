import * as vscode from 'vscode'
import type { Host } from '../domain/types'
import { WarpEngineClient } from '../infrastructure/warpEngineClient'

export class NoHostError extends Error {
  public constructor() {
    super('No WarpEngine host is set: run "WarpEngine: Set Host…" or set warpengine.url.')
    this.name = 'NoHostError'
  }
}

export class Hosts implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<Host | null> = new vscode.EventEmitter<Host | null>()
  private readonly subscription: vscode.Disposable
  public readonly onDidChange: vscode.Event<Host | null> = this.changed.event

  public constructor() {
    this.subscription = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (event.affectsConfiguration('warpengine.url') || event.affectsConfiguration('warpengine.hosts')) {
        void this.publishContext()
        this.changed.fire(this.current())
      }
    })
    void this.publishContext()
  }

  public known(): Host[] {
    const hosts: Host[] = vscode.workspace.getConfiguration('warpengine').get<Host[]>('hosts') ?? []
    return hosts.filter((host: Host) => typeof host.url === 'string' && host.url.trim().length > 0).map((host: Host) => ({ name: host.name || hostName(host.url), url: normalizeUrl(host.url) }))
  }

  public current(): Host | null {
    const url: string = normalizeUrl(vscode.workspace.getConfiguration('warpengine').get<string>('url') ?? '')
    if (!url) return null
    return this.known().find((host: Host) => host.url === url) ?? { name: hostName(url), url }
  }

  public require(): Host {
    const host: Host | null = this.current()
    if (!host) throw new NoHostError()
    return host
  }

  public async ensure(): Promise<Host | null> {
    return this.current() ?? (await this.select())
  }

  public client(token: string | null = null): WarpEngineClient {
    return new WarpEngineClient(this.require().url, token)
  }

  public async select(): Promise<Host | null> {
    const current: Host | null = this.current()
    const known: Host[] = this.known()
    if (current && !known.some((host: Host) => host.url === current.url)) known.unshift(current)
    let url: string | null = null
    if (known.length > 0) {
      const picked = await vscode.window.showQuickPick(
        [...known.map((host: Host) => ({ label: host.name, description: host.url, url: host.url })), { label: '$(add) Another host…', url: null as string | null }],
        { title: 'WarpEngine host', placeHolder: current?.url ?? 'Choose the host to work with' }
      )
      if (!picked) return null
      url = picked.url
    }
    if (url === null) {
      const typed: string | undefined = await vscode.window.showInputBox({
        title: 'WarpEngine host URL', prompt: 'The address of the site that runs WarpEngine', placeHolder: 'https://games.example.org',
        ignoreFocusOut: true, validateInput: validateUrl
      })
      if (!typed) return null
      url = normalizeUrl(typed)
      if (!known.some((host: Host) => host.url === url)) {
        await vscode.workspace.getConfiguration('warpengine').update('hosts', [...this.known(), { name: hostName(url), url }], vscode.ConfigurationTarget.Global)
      }
    }
    await vscode.workspace.getConfiguration('warpengine').update('url', url, vscode.ConfigurationTarget.Global)
    return this.current()
  }

  public dispose(): void {
    this.subscription.dispose()
    this.changed.dispose()
  }

  private async publishContext(): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'warpengine.hasHost', this.current() !== null)
  }
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function hostName(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function validateUrl(value: string): string | null {
  try {
    const url: URL = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? null : 'An http(s) URL'
  } catch {
    return 'An http(s) URL'
  }
}
