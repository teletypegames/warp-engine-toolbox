/**
 * Watches the host settings.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { HostService } from '../../domain/service/host.service'
import { Dialogs } from '../ui/dialogs'

const SETTINGS: readonly string[] = ['warpengine.url', 'warpengine.hosts']

/** Watches the `warpengine.url` and `warpengine.hosts` settings and keeps the `warpengine.hasHost` context key up to date. */
export class HostWatcher implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  /** Fires after one of the host settings changed. */
  public readonly onDidChange: vscode.Event<void> = this.changed.event
  private readonly subscription: vscode.Disposable

  /**
   * Starts watching and sets `warpengine.hasHost` for the first time.
   *
   * @param hosts - Tells whether a host is set.
   */
  public constructor(private readonly hosts: HostService) {
    this.subscription = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (!SETTINGS.some((setting: string) => event.affectsConfiguration(setting))) return
      void this.publishContext()
      this.changed.fire()
    })
    void this.publishContext()
  }

  /** Stops watching and releases the event emitter. */
  public dispose(): void {
    this.subscription.dispose()
    this.changed.dispose()
  }

  private async publishContext(): Promise<void> {
    await Dialogs.setContext('warpengine.hasHost', this.hosts.current() !== null)
  }
}
