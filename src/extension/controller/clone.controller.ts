/**
 * Clone…: a software's source from the catalog cloned into a local folder and opened.
 *
 * @packageDocumentation
 */

import type { Software } from '../../domain/model/catalog.model'
import type { PublicSoftware } from '../../domain/model/fork.model'
import type { CloneService } from '../../domain/service/clone.service'
import { Dialogs } from '../ui/dialogs'
import { FolderOpenDialog } from '../ui/folder-open.dialog'
import { t } from '../ui/l10n'
import type { TreeNode } from '../view/tree/tree.node'

/**
 * Serves `warpengine.cloneSoftware` and `warpengine.retryClone`. The failures of a clone carry the remedy *Try Again…*,
 * which runs the last clone or fork again.
 */
export class CloneController {
  private again: (() => Promise<void>) | null = null

  /**
   * Creates the controller.
   *
   * @param service - Reads the public catalog and clones.
   * @param opener - Offers to open the clone.
   */
  public constructor(private readonly service: CloneService, private readonly opener: FolderOpenDialog) {}

  /**
   * `warpengine.cloneSoftware`: reads the software from the public catalog, asks for the parent folder, clones the
   * source (SSH when it answers, HTTPS otherwise, without the history's blobs) with a progress notification, then offers
   * to open the folder, in its dev container when it has one.
   *
   * @param node - The software node of the Catalog view.
   * @throws {@link "domain/model/message.model".DomainError} When the software is not in the public catalog or the clone fails.
   */
  public async clone(node?: TreeNode): Promise<void> {
    const software: Software | null = CloneController.softwareOf(node)
    if (!software) return
    this.remember(async (): Promise<void> => { await this.clone(node) })
    const original: PublicSoftware = await this.service.software(software.name)
    const parent: string | null = await FolderOpenDialog.askParent(original.name, t('Clone here'))
    if (!parent) return
    const folder: string = await Dialogs.progress(t('WarpEngine: cloning {0}', original.title), async (report) =>
      this.service.clone({ software: original, parent, folderName: original.name, partial: true, report }))
    await this.opener.offer({ folder, message: t('{0} is cloned into {1}.', original.title, folder), devContainer: await this.service.hasDevContainer(folder) })
  }

  /**
   * Remembers how to run a flow again, for *Try Again…*.
   *
   * @param again - Runs the flow again.
   */
  public remember(again: () => Promise<void>): void {
    this.again = again
  }

  /**
   * `warpengine.retryClone`: runs the last clone or fork again; does nothing when there was none.
   */
  public async retry(): Promise<void> {
    if (this.again) await this.again()
  }

  /**
   * The software a command got from a node of the Catalog view.
   *
   * @param node - The node.
   * @returns Its software, or `null` when the node carries none.
   */
  public static softwareOf(node: TreeNode | undefined): Software | null {
    const data: unknown = node?.data
    return data && typeof data === 'object' && 'name' in data && typeof data.name === 'string' ? data as Software : null
  }
}
