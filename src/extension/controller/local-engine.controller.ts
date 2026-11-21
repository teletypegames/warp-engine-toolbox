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
import { RemedyDialog } from '../ui/remedy.dialog'

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

/** Receives a local engine that does not answer: `afterInstall` when the installer has just closed. */
export type MissingHandler = (afterInstall: boolean) => void

/** Serves `warpengine.installLocalEngine` and looks for a local engine on activation and refresh. */
export class LocalEngineController {
  private announced: string | null = null

  private missing: MissingHandler = () => undefined

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
    else if (LocalEngine.isLoopback(this.deps.hosts.current()?.url ?? '')) this.missing(false)
    else void this.offerInstall()
    return found
  }

  /**
   * Sets what happens when the host set is a local engine that does not answer (on a discovery, and after the installer).
   *
   * @param handler - Receives whether the installer has just closed.
   */
  public whenMissing(handler: MissingHandler): void {
    this.missing = handler
  }

  /**
   * `warpengine.installLocalEngine`: runs the WarpEngine Local installer in a terminal (`sh` on macOS and Linux, PowerShell on Windows).
   *
   * When the terminal closes, looks for the local engine again; when it still does not answer, the missing handler gets it.
   *
   * @param reuse - `true` runs it with `--yes`: the saved answers and the data stay, nothing is asked.
   */
  public install(reuse: boolean = false): void {
    const terminal: vscode.Terminal = vscode.window.createTerminal(LocalEngineController.installer(reuse))
    const closed: vscode.Disposable = vscode.window.onDidCloseTerminal((done: vscode.Terminal) => {
      if (done !== terminal) return
      closed.dispose()
      void this.discover().then((found: LocalEngine | null) => { if (!found) this.missing(true) })
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
      void RemedyDialog.report(error)
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

  private static installer(reuse: boolean): vscode.TerminalOptions {
    if (process.platform === 'win32') {
      const run: string = reuse ? `& ([scriptblock]::Create((irm ${LocalEngine.INSTALL_PS1}))) -Yes` : `irm ${LocalEngine.INSTALL_PS1} | iex`
      return { name: TERMINAL, shellPath: 'powershell.exe', shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${run}; Read-Host '${t('Press Enter to close')}'`] }
    }
    return { name: TERMINAL, shellPath: '/bin/sh', shellArgs: ['-c', `curl -fsSL ${LocalEngine.INSTALL_SH} | sh${reuse ? ' -s -- --yes' : ''}; printf '\\n%s ' '${t('Press Enter to close')}'; read _`] }
  }
}
