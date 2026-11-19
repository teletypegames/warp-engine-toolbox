/**
 * The VS Code authentication provider that signs in to WarpEngine hosts.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { DeviceGrant, Session } from '../../domain/model/sign-in.model'
import type { HostService } from '../../domain/service/host.service'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import type { SignInService } from '../../domain/service/sign-in.service'
import type { HostController } from '../controller/host.controller'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'

/** The id the provider is registered under, `warpengine`; `vscode.authentication.getSession` takes it. */
export const AUTH_PROVIDER_ID = 'warpengine'

type SessionsChange = vscode.AuthenticationProviderAuthenticationSessionsChangeEvent

/**
 * The `warpengine` authentication provider, shown as *WarpEngine* in the Accounts menu,
 * on {@link domain/service/sign-in.service!SignInService}: one session per host, for the current host.
 *
 * A remote host signs in with the device grant: the approval page opens in the browser
 * and a cancellable notification waits for an administrator to approve the code. A
 * WarpEngine Local host signs in with its local admin token, without a browser.
 */
export class WarpEngineAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<SessionsChange> = new vscode.EventEmitter<SessionsChange>()
  /** Fires when a session is added or removed, so VS Code updates the Accounts menu. */
  public readonly onDidChangeSessions: vscode.Event<SessionsChange> = this.changed.event
  private readonly registration: vscode.Disposable

  /**
   * Creates the provider and registers it with VS Code as `warpengine` (one account at a time).
   *
   * @param hosts - Tells the current host.
   * @param hostController - Asks for a host when none is set yet.
   * @param signIn - Runs the device grant and keeps the sessions.
   * @param local - Recognises the local engine and reads its admin token.
   */
  public constructor(
    private readonly hosts: HostService,
    private readonly hostController: HostController,
    private readonly signIn: SignInService,
    private readonly local: LocalEngineService
  ) {
    this.registration = vscode.authentication.registerAuthenticationProvider(AUTH_PROVIDER_ID, 'WarpEngine', this, { supportsMultipleAccounts: false })
  }

  /**
   * Returns the stored sessions of the current host; the requested scopes are not used to filter.
   *
   * @returns The sessions, or an empty list when no host is set.
   */
  public async getSessions(): Promise<vscode.AuthenticationSession[]> {
    const host: string | undefined = this.hosts.current()?.url
    return host ? (await this.signIn.forHost(host)).map((session: Session) => WarpEngineAuthProvider.toSession(session)) : []
  }

  /**
   * Signs in to the current host, asking for a host first when none is set.
   *
   * On the local engine it uses the local admin token. Elsewhere it starts a device grant,
   * opens the approval page in the browser, shows the code in a notification and waits
   * (with cancellable progress) for the approval. The new session is stored and announced
   * through {@link WarpEngineAuthProvider.onDidChangeSessions}.
   *
   * @param scopes - The scopes VS Code asks for; the toolbox's own scopes are added.
   * @returns The new session.
   * @throws `vscode.CancellationError` when no host is chosen or the wait is cancelled.
   */
  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const host: Host | null = await this.hostController.ensure()
    if (!host) throw new vscode.CancellationError()
    const wanted: readonly string[] = this.signIn.scopes(scopes)
    if (this.local.isLocal(host.url)) return this.adopt(await this.signIn.createSession(host.url, await this.local.token(), wanted))
    const grant: DeviceGrant = await this.signIn.start(host.url, `WarpEngine Toolbox (${vscode.env.appName})`, wanted)
    await WarpEngineAuthProvider.showApproval(host.url, grant)
    const token: string = await this.waitForApproval(host.url, grant)
    const created: vscode.AuthenticationSession = WarpEngineAuthProvider.toSession(await this.signIn.createSession(host.url, token, wanted))
    this.changed.fire({ added: [created], removed: [], changed: [] })
    return created
  }

  /**
   * Forgets a stored session and announces the removal; an unknown id does nothing.
   *
   * @param id - The session id.
   */
  public async removeSession(id: string): Promise<void> {
    const removed: Session | null = await this.signIn.remove(id)
    if (removed) this.changed.fire({ added: [], removed: [WarpEngineAuthProvider.toSession(removed)], changed: [] })
  }

  /**
   * Removes every session of the current host.
   */
  public async signOut(): Promise<void> {
    for (const session of await this.getSessions()) await this.removeSession(session.id)
  }

  /**
   * Unregisters the provider and releases its event emitter.
   */
  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
  }

  private adopt(session: Session): vscode.AuthenticationSession {
    const created: vscode.AuthenticationSession = WarpEngineAuthProvider.toSession(session)
    this.changed.fire({ added: [created], removed: [], changed: [] })
    return created
  }

  private async waitForApproval(host: string, grant: DeviceGrant): Promise<string> {
    const title: string = t('WarpEngine: waiting for the approval of {0}', grant.userCode)
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: true },
      async (_progress: vscode.Progress<unknown>, cancel: vscode.CancellationToken) => this.signIn.waitForApproval({
        host, grant, isCancelled: () => cancel.isCancellationRequested, cancelled: () => new vscode.CancellationError()
      }))
  }

  private static async showApproval(host: string, grant: DeviceGrant): Promise<void> {
    const open: string = t('Open the approval page')
    void vscode.window.showInformationMessage(t('Approve the code {0} on {1} as an administrator.', grant.userCode, host), { modal: false }, open)
      .then(async (answer: string | undefined) => { if (answer === open) await Dialogs.openExternal(grant.verificationUrlComplete) })
    await Dialogs.openExternal(grant.verificationUrlComplete)
  }

  private static toSession(session: Session): vscode.AuthenticationSession {
    return { id: session.id, accessToken: session.token, account: { id: session.host, label: session.label }, scopes: [...session.scopes] }
  }
}
