/**
 * The image gallery actions of a software in the catalog view.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import type { Software } from '../../domain/model/catalog.model'
import { ImageTypes } from '../../domain/model/image.model'
import type { Direction, ImageService } from '../../domain/service/image.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { ImageData } from '../view/tree/catalog.tree-view'
import type { TreeNode } from '../view/tree/tree.node'
import type { TreeProvider } from '../view/tree/tree.provider'

/**
 * Serves the gallery commands of the catalog view: `warpengine.addImage`, `warpengine.imageMakeDefault`, `warpengine.imageMoveUp`, `warpengine.imageMoveDown` and `warpengine.imageRemove`.
 */
export class ImageController {
  /**
   * Creates the controller.
   *
   * @param images - The image gallery on the host.
   * @param tree - The catalog view, redrawn after a change.
   */
  public constructor(private readonly images: ImageService, private readonly tree: TreeProvider) {}

  /**
   * `warpengine.addImage`: asks for image files (PNG, JPEG, GIF, WebP) in an open dialog and uploads them to the software, with a progress notification.
   *
   * Redraws the catalog view.
   *
   * @param node - The software or *Images* node; without one nothing happens.
   */
  public async add(node?: TreeNode): Promise<void> {
    const software: Software | undefined = node?.data as Software | undefined
    if (!software) return
    const files: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
      canSelectMany: true, openLabel: t('Add to {0}', software.title), filters: { [t('Images')]: ImageTypes.extensions() },
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
    })
    if (!files?.length) return
    await Dialogs.progress(t('Uploading images…'), async () => {
      for (const file of files) await this.images.add(software, file.path, await vscode.workspace.fs.readFile(file))
    })
    this.tree.refresh()
  }

  /**
   * `warpengine.imageMakeDefault`: makes an image the default one of its software and redraws the catalog view.
   *
   * @param node - The image node ({@link ImageData}); without one nothing happens.
   */
  public async makeDefault(node?: TreeNode): Promise<void> {
    const data: ImageData | undefined = node?.data as ImageData | undefined
    if (!data) return
    await this.images.makeDefault(data.image)
    this.tree.refresh()
  }

  /**
   * `warpengine.imageMoveUp`: moves an image one place earlier in the gallery and redraws the catalog view.
   *
   * @param node - The image node ({@link ImageData}); without one nothing happens.
   */
  public async moveUp(node?: TreeNode): Promise<void> {
    await this.move(node, -1)
  }

  /**
   * `warpengine.imageMoveDown`: moves an image one place later in the gallery and redraws the catalog view.
   *
   * @param node - The image node ({@link ImageData}); without one nothing happens.
   */
  public async moveDown(node?: TreeNode): Promise<void> {
    await this.move(node, 1)
  }

  /**
   * `warpengine.imageRemove`: after a confirmation, removes an image from the gallery and redraws the catalog view.
   *
   * @param node - The image node ({@link ImageData}); without one nothing happens.
   */
  public async remove(node?: TreeNode): Promise<void> {
    const data: ImageData | undefined = node?.data as ImageData | undefined
    if (!data || !(await Dialogs.confirm(t('Remove this image from {0}?', data.software.title), t('Remove')))) return
    await this.images.remove(data.image)
    this.tree.refresh()
  }

  private async move(node: TreeNode | undefined, direction: Direction): Promise<void> {
    const data: ImageData | undefined = node?.data as ImageData | undefined
    if (!data) return
    if (await this.images.move(data.software, data.image, direction)) this.tree.refresh()
  }
}
