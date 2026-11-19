import * as vscode from 'vscode'
import type { Software } from '../../domain/model/catalog.model'
import { ImageTypes } from '../../domain/model/image.model'
import type { Direction, ImageService } from '../../domain/service/image.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { ImageData } from '../view/tree/catalog.tree-view'
import type { TreeNode } from '../view/tree/tree.node'
import type { TreeProvider } from '../view/tree/tree.provider'

export class ImageController {
  public constructor(private readonly images: ImageService, private readonly tree: TreeProvider) {}

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

  public async makeDefault(node?: TreeNode): Promise<void> {
    const data: ImageData | undefined = node?.data as ImageData | undefined
    if (!data) return
    await this.images.makeDefault(data.image)
    this.tree.refresh()
  }

  public async moveUp(node?: TreeNode): Promise<void> {
    await this.move(node, -1)
  }

  public async moveDown(node?: TreeNode): Promise<void> {
    await this.move(node, 1)
  }

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
