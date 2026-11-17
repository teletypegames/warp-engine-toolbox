import * as vscode from 'vscode'
import type { DeviceGrant, Principal } from '../domain/types'
import { TOOL_SCOPES, WarpEngineClient, type TokenPoll } from '../infrastructure/warpEngineClient'
import type { Hosts } from './hosts'

export const PROVIDER_ID = 'warpengine'
const STORE_KEY = 'warpengine.sessions'

interface StoredSession {
  readonly id: string
  readonly host: string
  readonly token: string
  readonly label: string
  readonly scopes: readonly string[]
}

export class WarpEngineAuth implements vscode.AuthenticationProvider, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>()
  public readonly onDidChangeSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> = this.changed.event
  private readonly registration: vscode.Disposable

  public constructor(private readonly secrets: vscode.SecretStorage, private readonly hosts: Hosts) {
    this.registration = vscode.authentication.registerAuthenticationProvider(PROVIDER_ID, 'WarpEngine', this, { supportsMultipleAccounts: false })
  }

  public async getSessions(): Promise<vscode.AuthenticationSession[]> {
    const host: string = this.hosts.current().url
    return (await this.stored()).filter((session: StoredSession) => session.host === host).map(toSession)
  }

  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const host: string = this.hosts.current().url
    const client: WarpEngineClient = new WarpEngineClient(host)
    const wanted: readonly string[] = scopes.length > 0 ? scopes : TOOL_SCOPES
    const grant: DeviceGrant = await client.startDeviceGrant(`WarpEngine Toolbox (${vscode.env.appName})`, wanted)
    const open = 'Open the approval page'
    void vscode.window.showInformationMessage(
      `Approve the code ${grant.userCode} on ${host} as an administrator.`, { modal: false }, open
    ).then(async (answer: string | undefined) => { if (answer === open) await vscode.env.openExternal(vscode.Uri.parse(grant.verificationUrlComplete)) })
    await vscode.env.openExternal(vscode.Uri.parse(grant.verificationUrlComplete))

    const token: string = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `WarpEngine: waiting for the approval of ${grant.userCode}`, cancellable: true },
      async (_progress: vscode.Progress<unknown>, cancel: vscode.CancellationToken) => poll(client, grant, cancel)
    )
    const principal: Principal = await client.withToken(token).me().catch((): Principal => ({ label: null, scopes: [...wanted] }))
    const session: StoredSession = { id: `${host}#${String(Date.now())}`, host, token, label: principal.label ?? host, scopes: principal.scopes }
    await this.store([...(await this.stored()).filter((stored: StoredSession) => stored.host !== host), session])
    const created: vscode.AuthenticationSession = toSession(session)
    this.changed.fire({ added: [created], removed: [], changed: [] })
    return created
  }

  public async removeSession(id: string): Promise<void> {
    const sessions: StoredSession[] = await this.stored()
    const removed: StoredSession | undefined = sessions.find((session: StoredSession) => session.id === id)
    await this.store(sessions.filter((session: StoredSession) => session.id !== id))
    if (removed) this.changed.fire({ added: [], removed: [toSession(removed)], changed: [] })
  }

  public async token(createIfNone: boolean): Promise<string | null> {
    const session: vscode.AuthenticationSession | undefined = await vscode.authentication.getSession(PROVIDER_ID, [...TOOL_SCOPES], createIfNone ? { createIfNone: true } : { silent: true })
    return session?.accessToken ?? null
  }

  public async client(createIfNone: boolean): Promise<WarpEngineClient | null> {
    const token: string | null = await this.token(createIfNone)
    return token ? this.hosts.client(token) : null
  }

  public async signOut(): Promise<void> {
    for (const session of await this.getSessions()) await this.removeSession(session.id)
  }

  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
  }

  private async stored(): Promise<StoredSession[]> {
    const raw: string | undefined = await this.secrets.get(STORE_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw) as StoredSession[]
    } catch {
      return []
    }
  }

  private async store(sessions: readonly StoredSession[]): Promise<void> {
    await this.secrets.store(STORE_KEY, JSON.stringify(sessions))
  }
}

async function poll(client: WarpEngineClient, grant: DeviceGrant, cancel: vscode.CancellationToken): Promise<string> {
  const deadline: number = Date.now() + grant.expiresIn * 1000
  const interval: number = Math.max(grant.interval, 2) * 1000
  while (Date.now() < deadline) {
    if (cancel.isCancellationRequested) throw new vscode.CancellationError()
    await new Promise((done: (value: unknown) => void) => setTimeout(done, interval))
    const answer: TokenPoll = await client.pollDeviceGrant(grant.deviceCode)
    if (answer.state === 'approved' && answer.token) return answer.token
    if (answer.state === 'denied') throw new Error('The sign-in was denied.')
    if (answer.state === 'expired') break
  }
  throw new Error('The sign-in code expired.')
}

function toSession(session: StoredSession): vscode.AuthenticationSession {
  return { id: session.id, accessToken: session.token, account: { id: session.host, label: session.label }, scopes: [...session.scopes] }
}
