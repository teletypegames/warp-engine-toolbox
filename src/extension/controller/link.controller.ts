/**
 * Opening and copying the links of the tree views.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import { TreeNode } from '../view/tree/tree.node'

const STATUS_MS = 4000

/** Serves `warpengine.openUrl` and `warpengine.copyLink`. */
export class LinkController {
  /**
   * `warpengine.openUrl`: opens a link in the browser.
   *
   * @param target - The URL, or a tree node whose command carries one; without a URL nothing happens.
   */
  public async open(target?: string | TreeNode): Promise<void> {
    const url: string | undefined = LinkController.urlOf(target)
    if (url) await Dialogs.openExternal(url)
  }

  /**
   * `warpengine.copyLink`: copies a link to the clipboard and confirms it in the status bar.
   *
   * @param target - The URL, or a tree node whose command carries one; without a URL nothing happens.
   */
  public async copy(target?: string | TreeNode): Promise<void> {
    const url: string | undefined = LinkController.urlOf(target)
    if (!url) return
    await vscode.env.clipboard.writeText(url)
    void vscode.window.setStatusBarMessage(t('Copied {0}', url), STATUS_MS)
  }

  private static urlOf(target: string | TreeNode | undefined): string | undefined {
    return typeof target === 'string' ? target : TreeNode.linkOf(target)
  }
}
