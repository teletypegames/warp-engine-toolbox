import * as vscode from 'vscode'
import { errorText } from '../../ui/l10n'
import { TreeNode } from './tree.node'

export interface TreeView {
  roots(): Promise<TreeNode[]>
}

export class TreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>()
  public readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this.changed.event

  public constructor(private readonly view: TreeView) {}

  public refresh(): void {
    this.changed.fire(undefined)
  }

  public getTreeItem(node: TreeNode): TreeNode {
    return node
  }

  public async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    try {
      return node ? await Promise.resolve(node.load?.() ?? []) : await this.view.roots()
    } catch (error: unknown) {
      return [new TreeNode(errorText(error), { icon: 'warning' })]
    }
  }

  public dispose(): void {
    this.changed.dispose()
  }
}
