/**
 * The guard of the steps that act on this computer's Docker — install, remove or start the local engine, start
 * Docker — in a window that runs in a dev container.
 *
 * @module
 */
import * as vscode from 'vscode'
import { Dialogs } from './dialogs'
import { t } from './l10n'

const REOPEN_LOCALLY = 'remote-containers.reopenLocally'

/** Keeps the computer's steps out of a dev container window and offers to reopen the folder on the computer instead. */
export class HostMachineDialog {
  /**
   * Tells whether a step on this computer's Docker may run here; in a dev container it may not, and the user is asked
   * to reopen the folder on the computer (`remote-containers.reopenLocally`), where the step works.
   *
   * @param inside - Whether this window runs in a dev container.
   * @returns `true` outside a dev container.
   */
  public static async allows(inside: boolean): Promise<boolean> {
    if (!inside) return true
    await HostMachineDialog.offerReopen(t('This window runs in a dev container.'), t('The local engine and Docker are on the computer, not in the container: reopen the folder on the computer and do it there.'))
    return false
  }

  /**
   * Asks, in a modal dialog, to reopen the folder on the computer, and does it when asked.
   *
   * @param message - The message.
   * @param detail - The line under it.
   */
  public static async offerReopen(message: string, detail: string): Promise<void> {
    const reopen: string = HostMachineDialog.label()
    if ((await Dialogs.choose(message, detail, reopen)) === reopen) await HostMachineDialog.reopen()
  }

  /**
   * Gives the label of the step that reopens the folder on the computer.
   *
   * @returns *Reopen Folder Locally*, translated.
   */
  public static label(): string {
    return t('Reopen Folder Locally')
  }

  /**
   * Reopens the folder on the computer (the Dev Containers command).
   */
  public static async reopen(): Promise<void> {
    await vscode.commands.executeCommand(REOPEN_LOCALLY)
  }
}
