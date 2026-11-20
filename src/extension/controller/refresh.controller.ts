/**
 * Refreshing everything the toolbox shows.
 *
 * @packageDocumentation
 */

import type { PlatformService } from '../../domain/service/platform.service'
import type { DashboardPanel } from '../view/dashboard/dashboard.panel'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'
import type { LocalEngineController } from './local-engine.controller'

/** What {@link RefreshController} refreshes. */
export interface RefreshDependencies {
  /** The host's platform descriptions, fetched again. */
  readonly platforms: PlatformService
  /** The projects of the workspace, read again. */
  readonly projects: ProjectRegistry
  /** The remote state, fetched again. */
  readonly states: RemoteStateStore
  /** The tree views, redrawn. */
  readonly trees: readonly TreeProvider[]
  /** Looks for the local engine again. */
  readonly localEngine: LocalEngineController
  /** The Dashboard tab, redrawn when open. */
  readonly dashboard: DashboardPanel
}

/** Serves `warpengine.refresh`; also run after a sign-in, a sign-out, a host change and a purge. */
export class RefreshController {
  /**
   * Creates the controller.
   *
   * @param deps - What it refreshes.
   */
  public constructor(private readonly deps: RefreshDependencies) {}

  /**
   * `warpengine.refresh`: looks for the local engine, fetches the platforms again, re-reads the projects, refreshes the remote state and redraws every tree view and the open Dashboard; a failing discovery or platform fetch is ignored.
   */
  public async refresh(): Promise<void> {
    await this.deps.localEngine.discover().catch(() => null)
    await this.deps.platforms.all(true).catch(() => undefined)
    await this.deps.projects.refresh()
    await this.deps.states.refresh()
    for (const tree of this.deps.trees) tree.refresh()
    await this.deps.dashboard.refresh()
  }
}
