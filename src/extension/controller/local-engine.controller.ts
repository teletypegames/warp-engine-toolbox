import * as vscode from 'vscode'
import { LocalEngine } from '../../domain/model/local-engine.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { HostService } from '../../domain/service/host.service'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import { Dialogs } from '../ui/dialogs'
import { errorText, t } from '../ui/l10n'

const OFFERED_KEY = 'warpengine.localEngineOffered'
const TERMINAL = 'WarpEngine Local'

export interface LocalEngineDependencies {
  readonly local: LocalEngineService
  readonly hosts: HostService
  readonly connection: ConnectionService
  readonly state: vscode.Memento
}

export class LocalEngineController {
  private announced: string | null = null

  public constructor(private readonly deps: LocalEngineDependencies) {}

  public async discover(): Promise<LocalEngine | null> {
    const found: LocalEngine | null = await this.deps.local.discover()
    await Dialogs.setContext('warpengine.localEngine', found !== null)
    if (found) void this.connect(found)
    else void this.offerInstall()
    return found
  }

  public install(): void {
    const terminal: vscode.Terminal = vscode.window.createTerminal(LocalEngineController.installer())
    const closed: vscode.Disposable = vscode.window.onDidCloseTerminal((done: vscode.Terminal) => {
      if (done !== terminal) return
      closed.dispose()
      void this.discover()
    })
    terminal.show()
  }

  private async connect(found: LocalEngine): Promise<void> {
    if (this.announced === found.url || !this.deps.local.isCurrentHost()) return
    if ((await this.deps.connection.token(false)) !== null) return
    this.announced = found.url
    const connect: string = t('Connect')
    const target: string = found.syncTarget ?? t('nowhere')
    const answer: string | undefined = await Dialogs.ask(t('Your local WarpEngine {0} runs at {1}; its releases sync to {2}. Connect to it?', found.info.version, found.url, target), connect)
    if (answer !== connect) return
    try {
      await vscode.commands.executeCommand('warpengine.signIn')
    } catch (error: unknown) {
      Dialogs.error(errorText(error))
    }
  }

  private async offerInstall(): Promise<void> {
    if (this.deps.hosts.current() || this.deps.state.get<boolean>(OFFERED_KEY)) return
    await this.deps.state.update(OFFERED_KEY, true)
    const install: string = t('Install a local engine')
    const host: string = t('Set Host…')
    const answer: string | undefined = await Dialogs.ask(t('No WarpEngine host yet. Install one on this machine (Docker), or set the address of one?'), install, host)
    if (answer === install) this.install()
    if (answer === host) await vscode.commands.executeCommand('warpengine.selectHost')
  }

  private static installer(): vscode.TerminalOptions {
    if (process.platform === 'win32') {
      return { name: TERMINAL, shellPath: 'powershell.exe', shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `irm ${LocalEngine.INSTALL_PS1} | iex; Read-Host '${t('Press Enter to close')}'`] }
    }
    return { name: TERMINAL, shellPath: '/bin/sh', shellArgs: ['-c', `curl -fsSL ${LocalEngine.INSTALL_SH} | sh; printf '\\n%s ' '${t('Press Enter to close')}'; read _`] }
  }
}
