/**
 * Finding a WarpEngine on this machine and installing one.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { LocalEngine } from '../../domain/model/local-engine.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { HostService } from '../../domain/service/host.service'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import { Remedies } from '../ui/remedies'

const OFFERED_KEY = 'warpengine.localEngineOffered'
const TERMINAL = 'WarpEngine Local'

/** What {@link LocalEngineController} works with. */
export interface LocalEngineDependencies {
  /** Discovers the local engine. */
  readonly local: LocalEngineService
  /** The configured hosts. */
  readonly hosts: HostService
  /** Tells whether the current host has a token. */
  readonly connection: ConnectionService
  /** The global state that remembers that the install was offered. */
  readonly state: vscode.Memento
}

/** Serves `warpengine.installLocalEngine` and looks for a local engine on activation and refresh. */
export class LocalEngineController {
  private announced: string | null = null

  /**
   * Creates the controller.
   *
   * @param deps - The services and the memento it uses.
   */
  public constructor(private readonly deps: LocalEngineDependencies) {}

  /**
   * Looks for a WarpEngine running on this machine and sets the `warpengine.localEngine` context key.
   *
   * When one is found and it is the current host without a token, offers once to connect to it (runs `warpengine.signIn`); when none is found and no host is set, offers once to install one or to set a host.
   *
   * @returns The local engine, or `null` when none runs.
   */
  public async discover(): Promise<LocalEngine | null> {
    const found: LocalEngine | null = await this.deps.local.discover()
    await Dialogs.setContext('warpengine.localEngine', found !== null)
    if (found) void this.connect(found)
    else void this.offerInstall()
    return found
  }

  /**
   * `warpengine.installLocalEngine`: runs the WarpEngine Local installer in a terminal (`sh` on macOS and Linux, PowerShell on Windows).
   *
   * When the terminal closes, looks for the local engine again.
   */
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
      void Remedies.report(error)
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
