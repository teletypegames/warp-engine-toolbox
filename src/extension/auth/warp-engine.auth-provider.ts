import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { DeviceGrant, Session } from '../../domain/model/sign-in.model'
import type { HostService } from '../../domain/service/host.service'
import type { SignInService } from '../../domain/service/sign-in.service'
import type { HostController } from '../controller/host.controller'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'

export const AUTH_PROVIDER_ID = 'warpengine'

type SessionsChange = vscode.AuthenticationProviderAuthenticationSessionsChangeEvent

export class WarpEngineAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<SessionsChange> = new vscode.EventEmitter<SessionsChange>()
  public readonly onDidChangeSessions: vscode.Event<SessionsChange> = this.changed.event
  private readonly registration: vscode.Disposable

  public constructor(private readonly hosts: HostService, private readonly hostController: HostController, private readonly signIn: SignInService) {
    this.registration = vscode.authentication.registerAuthenticationProvider(AUTH_PROVIDER_ID, 'WarpEngine', this, { supportsMultipleAccounts: false })
  }

  public async getSessions(): Promise<vscode.AuthenticationSession[]> {
    const host: string | undefined = this.hosts.current()?.url
    return host ? (await this.signIn.forHost(host)).map((session: Session) => WarpEngineAuthProvider.toSession(session)) : []
  }

  public async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
    const host: Host | null = await this.hostController.ensure()
    if (!host) throw new vscode.CancellationError()
    const wanted: readonly string[] = this.signIn.scopes(scopes)
    const grant: DeviceGrant = await this.signIn.start(host.url, `WarpEngine Toolbox (${vscode.env.appName})`, wanted)
    await WarpEngineAuthProvider.showApproval(host.url, grant)
    const token: string = await this.waitForApproval(host.url, grant)
    const created: vscode.AuthenticationSession = WarpEngineAuthProvider.toSession(await this.signIn.createSession(host.url, token, wanted))
    this.changed.fire({ added: [created], removed: [], changed: [] })
    return created
  }

  public async removeSession(id: string): Promise<void> {
    const removed: Session | null = await this.signIn.remove(id)
    if (removed) this.changed.fire({ added: [], removed: [WarpEngineAuthProvider.toSession(removed)], changed: [] })
  }

  public async signOut(): Promise<void> {
    for (const session of await this.getSessions()) await this.removeSession(session.id)
  }

  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
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
