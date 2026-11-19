/**
 * The node of every tree view.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { t } from '../../ui/l10n'

/** Loads the children of a node when it is expanded. */
export type Children = () => TreeNode[] | Promise<TreeNode[]>

/** How a {@link TreeNode} looks and behaves. */
export interface TreeNodeOptions {
  /** The dimmed text after the label. */
  readonly description?: string
  /** The hover text. */
  readonly tooltip?: string | vscode.MarkdownString
  /** A codicon id. */
  readonly icon?: string
  /** The `contextValue` the menus of `package.json` match, space-separated words such as `link` or `release`. */
  readonly context?: string
  /** Run on click. */
  readonly command?: vscode.Command
  /** Loads the children; without it the node is a leaf. */
  readonly load?: Children
  /** Whether a node with children starts expanded. */
  readonly expanded?: boolean
  /** What the commands run on the node receive. */
  readonly data?: unknown
}

/** A tree item with lazily loaded children and data for the commands run on it. */
export class TreeNode extends vscode.TreeItem {
  /** Loads the children; `null` for a leaf. */
  public readonly load: Children | null
  /** What the commands run on the node receive. */
  public readonly data: unknown

  /**
   * Creates a node.
   *
   * @param label - The label.
   * @param options - The look and behaviour.
   */
  public constructor(label: string, options: TreeNodeOptions = {}) {
    super(label, TreeNode.collapsible(options))
    if (options.description !== undefined) this.description = options.description
    if (options.tooltip !== undefined) this.tooltip = options.tooltip
    if (options.icon) this.iconPath = new vscode.ThemeIcon(options.icon)
    if (options.context) this.contextValue = options.context
    if (options.command) this.command = options.command
    this.load = options.load ?? null
    this.data = options.data
  }

  /**
   * The command that opens a URL with `warpengine.openUrl`.
   *
   * @param url - The URL.
   * @returns The command.
   */
  public static openUrl(url: string): vscode.Command {
    return { title: 'Open', command: 'warpengine.openUrl', arguments: [url] }
  }

  /**
   * A node for a host that refused the stored token: a click runs `warpengine.reauthorize`.
   *
   * @returns The node.
   */
  public static reauthorize(): TreeNode {
    return new TreeNode(t('Not authorized on this host'), {
      description: t('click to sign in again'), icon: 'key', tooltip: t('The host refused the stored token: sign in again.'),
      command: { title: t('Sign In Again'), command: 'warpengine.reauthorize' }
    })
  }

  /**
   * The URL a node opens on click.
   *
   * @param node - The node.
   * @returns The URL, or `undefined` when the node opens none.
   */
  public static linkOf(node: TreeNode | undefined): string | undefined {
    const argument: unknown = node?.command?.arguments?.[0]
    return typeof argument === 'string' ? argument : undefined
  }

  private static collapsible(options: TreeNodeOptions): vscode.TreeItemCollapsibleState {
    if (!options.load) return vscode.TreeItemCollapsibleState.None
    return options.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
  }
}
