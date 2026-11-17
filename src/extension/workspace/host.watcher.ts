import * as vscode from 'vscode'
import type { HostService } from '../../domain/service/host.service'
import { Dialogs } from '../ui/dialogs'

const SETTINGS: readonly string[] = ['warpengine.url', 'warpengine.hosts']

export class HostWatcher implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChange: vscode.Event<void> = this.changed.event
  private readonly subscription: vscode.Disposable

  public constructor(private readonly hosts: HostService) {
    this.subscription = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (!SETTINGS.some((setting: string) => event.affectsConfiguration(setting))) return
      void this.publishContext()
      this.changed.fire()
    })
    void this.publishContext()
  }

  public dispose(): void {
    this.subscription.dispose()
    this.changed.dispose()
  }

  private async publishContext(): Promise<void> {
    await Dialogs.setContext('warpengine.hasHost', this.hosts.current() !== null)
  }
}
