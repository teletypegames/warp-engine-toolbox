/**
 * The hint to reload a dev container window into which the toolbox was installed after it opened.
 *
 * @module
 */
import { stat } from 'node:fs/promises'
import * as vscode from 'vscode'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'

/**
 * Offers *Reload Window* when the toolbox was installed after this window's extension host started, as on the first
 * opening of a dev container: the window read `tasks.json` before the `warpengine` task type existed, so its tasks
 * fail until it reloads.
 */
export class LateInstallHint {
  /**
   * Compares the time of the toolbox's folder with the start of the extension host and, inside a dev container when
   * the folder is newer, asks to reload the window (`workbench.action.reloadWindow`).
   *
   * @param extensionPath - The toolbox's installation folder.
   * @param inside - Whether this window runs in a dev container.
   */
  public static async offer(extensionPath: string, inside: boolean): Promise<void> {
    if (!inside) return
    const folder = await stat(extensionPath).catch(() => null)
    if (!folder || Math.max(folder.birthtimeMs, folder.ctimeMs) <= Date.now() - process.uptime() * 1000) return
    const reload: string = t('Reload Window')
    const answer: string | undefined = await Dialogs.ask(t('The WarpEngine Toolbox was installed in this dev container after the window opened: reload the window so its tasks work.'), reload)
    if (answer === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow')
  }
}
