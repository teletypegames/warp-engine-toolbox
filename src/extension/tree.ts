import * as vscode from 'vscode'

export class Node extends vscode.TreeItem {
  public readonly load: (() => Node[] | Promise<Node[]>) | null
  public readonly data: unknown

  public constructor(label: string, options: {
    description?: string
    tooltip?: string | vscode.MarkdownString
    icon?: string
    context?: string
    command?: vscode.Command
    load?: () => Node[] | Promise<Node[]>
    expanded?: boolean
    data?: unknown
  } = {}) {
    super(label, options.load ? (options.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None)
    if (options.description !== undefined) this.description = options.description
    if (options.tooltip !== undefined) this.tooltip = options.tooltip
    if (options.icon) this.iconPath = new vscode.ThemeIcon(options.icon)
    if (options.context) this.contextValue = options.context
    if (options.command) this.command = options.command
    this.load = options.load ?? null
    this.data = options.data
  }
}

export class NodeProvider implements vscode.TreeDataProvider<Node>, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<Node | undefined> = new vscode.EventEmitter<Node | undefined>()
  public readonly onDidChangeTreeData: vscode.Event<Node | undefined> = this.changed.event

  public constructor(private readonly roots: () => Promise<Node[]>) {}

  public refresh(): void {
    this.changed.fire(undefined)
  }

  public getTreeItem(node: Node): Node {
    return node
  }

  public async getChildren(node?: Node): Promise<Node[]> {
    try {
      return node ? await Promise.resolve(node.load?.() ?? []) : await this.roots()
    } catch (error: unknown) {
      return [new Node(error instanceof Error ? error.message : String(error), { icon: 'warning' })]
    }
  }

  public dispose(): void {
    this.changed.dispose()
  }
}

export function openUrl(url: string): vscode.Command {
  return { title: 'Open', command: 'warpengine.openUrl', arguments: [url] }
}
