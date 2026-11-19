import * as vscode from 'vscode'
import { t } from '../../ui/l10n'

export type Children = () => TreeNode[] | Promise<TreeNode[]>

export interface TreeNodeOptions {
  readonly description?: string
  readonly tooltip?: string | vscode.MarkdownString
  readonly icon?: string
  readonly context?: string
  readonly command?: vscode.Command
  readonly load?: Children
  readonly expanded?: boolean
  readonly data?: unknown
}

export class TreeNode extends vscode.TreeItem {
  public readonly load: Children | null
  public readonly data: unknown

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

  public static openUrl(url: string): vscode.Command {
    return { title: 'Open', command: 'warpengine.openUrl', arguments: [url] }
  }

  public static reauthorize(): TreeNode {
    return new TreeNode(t('Not authorized on this host'), {
      description: t('click to sign in again'), icon: 'key', tooltip: t('The host refused the stored token: sign in again.'),
      command: { title: t('Sign In Again'), command: 'warpengine.reauthorize' }
    })
  }

  public static linkOf(node: TreeNode | undefined): string | undefined {
    const argument: unknown = node?.command?.arguments?.[0]
    return typeof argument === 'string' ? argument : undefined
  }

  private static collapsible(options: TreeNodeOptions): vscode.TreeItemCollapsibleState {
    if (!options.load) return vscode.TreeItemCollapsibleState.None
    return options.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
  }
}
