/**
 * The VS Code tree data provider over a {@link TreeView}.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { HostError } from '../../../domain/model/host-error.model'
import type { Remedy } from '../../../domain/model/message.model'
import { errorText } from '../../ui/l10n'
import { Remedies } from '../../ui/remedies'
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

  private roots: Promise<TreeNode[]> | null = null

  /** Drops the loaded roots and redraws the whole tree. */
  public refresh(): void {
    this.roots = null
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
   * Returns the parent of a node; only roots are revealed, so there is none.
   *
   * @returns `undefined`.
   */
  public getParent(): undefined {
    return undefined
  }

  /**
   * Returns the roots of the view (loaded once until {@link TreeProvider.refresh}, so a reveal finds the same nodes the
   * view shows), or the loaded children of a node.
   *
   * A failure becomes a single node: *Not authorized* (click to sign in again) when the host refused the token, the error text otherwise —
   * with its remedy as the click when it has one.
   *
   * @param node - The parent node; `undefined` for the roots.
   * @returns The nodes.
   */
  public async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (node) return TreeProvider.guarded(async () => Promise.resolve(node.load?.() ?? []))
    this.roots ??= TreeProvider.guarded(async () => this.view.roots())
    return this.roots
  }

  private static async guarded(load: () => Promise<TreeNode[]>): Promise<TreeNode[]> {
    try {
      return await load()
    } catch (error: unknown) {
      if (HostError.isUnauthorized(error)) return [TreeNode.reauthorize()]
      const remedy: Remedy | null = Remedies.of(error)
      return [new TreeNode(errorText(error), { icon: 'warning', ...(remedy ? { description: Remedies.label(remedy), command: Remedies.command(remedy) } : {}) })]
    }
  }

  /** Disposes the change event. */
  public dispose(): void {
    this.changed.dispose()
  }
}
