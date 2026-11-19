/**
 * The VS Code tree data provider over a {@link TreeView}.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { HostError } from '../../../domain/model/host-error.model'
import { errorText } from '../../ui/l10n'
import { TreeNode } from './tree.node'

/** The content of a tree view: its root nodes. */
export interface TreeView {
  /**
   * Returns the root nodes.
   *
   * @returns The root nodes.
   */
  roots(): Promise<TreeNode[]>
}

/** The tree data provider of a WarpEngine view: roots from its {@link TreeView}, children from the nodes, a failure shown as a node. */
export class TreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<TreeNode | undefined> = new vscode.EventEmitter<TreeNode | undefined>()
  /** Fires when the whole tree must be redrawn. */
  public readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined> = this.changed.event

  /**
   * Creates the provider.
   *
   * @param view - The content of the view.
   */
  public constructor(private readonly view: TreeView) {}

  /** Redraws the whole tree. */
  public refresh(): void {
    this.changed.fire(undefined)
  }

  /**
   * Returns the node itself: a {@link TreeNode} is its own tree item.
   *
   * @param node - The node.
   * @returns The node.
   */
  public getTreeItem(node: TreeNode): TreeNode {
    return node
  }

  /**
   * Returns the roots of the view, or the loaded children of a node.
   *
   * A failure becomes a single node: *Not authorized* (click to sign in again) when the host refused the token, the error text otherwise.
   *
   * @param node - The parent node; `undefined` for the roots.
   * @returns The nodes.
   */
  public async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    try {
      return node ? await Promise.resolve(node.load?.() ?? []) : await this.view.roots()
    } catch (error: unknown) {
      return [HostError.isUnauthorized(error) ? TreeNode.reauthorize() : new TreeNode(errorText(error), { icon: 'warning' })]
    }
  }

  /** Disposes the change event. */
  public dispose(): void {
    this.changed.dispose()
  }
}
