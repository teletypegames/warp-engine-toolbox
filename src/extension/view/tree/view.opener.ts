/**
 * Opens the collapsed Catalog and Local Server views when they have something to say.
 *
 * @packageDocumentation
 */

import type * as vscode from 'vscode'
import type { ServerContainer } from '../../../domain/model/server.model'
import type { ServerService } from '../../../domain/service/server.service'
import type { TreeNode } from './tree.node'
import type { TreeProvider } from './tree.provider'

const CATALOG_OPENED_KEY = 'warpengine.catalogOpened'

/** A view the opener can open, with its content. */
export interface OpenableView {
  /** The VS Code view. */
  readonly view: vscode.TreeView<TreeNode>
  /** Its content. */
  readonly provider: TreeProvider
}

/** What {@link ViewOpener} works with. */
export interface ViewOpenerDependencies {
  /** Every WarpEngine view; one of them visible means the sidebar is shown. */
  readonly views: readonly vscode.TreeView<TreeNode>[]
  /** The Catalog view. */
  readonly catalog: OpenableView
  /** The Local Server view. */
  readonly servers: OpenableView
  /** Lists the local containers. */
  readonly containers: ServerService
  /** The global state, where the first opening of the Catalog is remembered. */
  readonly memory: vscode.Memento
}

/**
 * Both views start collapsed. While the WarpEngine sidebar is shown, the opener expands the Local Server view once per
 * window when no local engine is installed (its install node shows), and the Catalog view once ever, at its first
 * load with content. It never collapses a view and never takes the focus.
 */
export class ViewOpener {
  private serversChecked = false
  private running: Promise<void> | null = null

  /**
   * Creates the opener; it does nothing until {@link ViewOpener.watch}.
   *
   * @param deps - The views, the containers and the memory.
   */
  public constructor(private readonly deps: ViewOpenerDependencies) {}

  /**
   * Starts listening: a view becoming visible or the Catalog redrawing (such as after a sign-in) tries to open them.
   *
   * @returns The subscriptions.
   */
  public watch(): vscode.Disposable[] {
    const tryOpen = (): void => { void this.open() }
    return [
      ...this.deps.views.map((view: vscode.TreeView<TreeNode>) => view.onDidChangeVisibility(tryOpen)),
      this.deps.catalog.provider.onDidChangeTreeData(tryOpen)
    ]
  }

  /**
   * Opens what is due while the sidebar is shown: reads the containers (Docker) and the Catalog's roots (the host).
   */
  public async open(): Promise<void> {
    this.running ??= this.openDue().finally(() => { this.running = null })
    return this.running
  }

  private async openDue(): Promise<void> {
    if (!this.deps.views.some((view: vscode.TreeView<TreeNode>) => view.visible)) return
    await this.openServers()
    await this.openCatalog()
  }

  private async openServers(): Promise<void> {
    if (this.serversChecked) return
    this.serversChecked = true
    const containers: ServerContainer[] | null = await this.deps.containers.containers().catch((): null => null)
    if (containers === null || containers.length === 0) await ViewOpener.reveal(this.deps.servers)
  }

  private async openCatalog(): Promise<void> {
    if (this.deps.memory.get<boolean>(CATALOG_OPENED_KEY)) return
    if (await ViewOpener.reveal(this.deps.catalog)) await this.deps.memory.update(CATALOG_OPENED_KEY, true)
  }

  private static async reveal(target: OpenableView): Promise<boolean> {
    if (target.view.visible) return true
    const [first] = await target.provider.getChildren()
    if (!first) return false
    await Promise.resolve(target.view.reveal(first, { select: false, focus: false, expand: false })).catch(() => undefined)
    return true
  }
}
