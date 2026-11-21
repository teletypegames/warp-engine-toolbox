/**
 * Purge Local Engine…: the local WarpEngine removed from this machine.
 *
 * @packageDocumentation
 */

import type { PurgePlan } from '../../domain/model/server.model'
import { Servers } from '../../domain/model/server.model'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import type { ServerService } from '../../domain/service/server.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import type { TreeNode } from '../view/tree/tree.node'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { LocalEngineController } from './local-engine.controller'
import type { RefreshController } from './refresh.controller'

/** What {@link ServersController} works with. */
export interface ServersDependencies {
  /** The local containers and their purge. */
  readonly servers: ServerService
  /** Tells whether the local engine is the current host. */
  readonly local: LocalEngineService
  /** Signs out of the purged engine. */
  readonly auth: WarpEngineAuthProvider
  /** Looks for the local engine again after the purge. */
  readonly localEngine: LocalEngineController
  /** Refreshes the views after the purge. */
  readonly refresh: RefreshController
}

/** Serves `warpengine.purgeLocalEngine`. */
export class ServersController {
  /**
   * Creates the controller.
   *
   * @param deps - The services and controllers it uses.
   */
  public constructor(private readonly deps: ServersDependencies) {}

  /**
   * `warpengine.stopDevContainer`: stops the dev container of a Local Server node (it is kept for the next start) and redraws the views.
   *
   * @param node - The dev container's node; its data is the container id. Without one nothing happens.
   */
  public async stopDevContainer(node?: TreeNode): Promise<void> {
    if (typeof node?.data !== 'string') return
    await this.deps.servers.stopDevContainer(node.data)
    await this.deps.refresh.refresh()
  }

  /**
   * `warpengine.purgeLocalEngine`: after a confirmation that lists what goes, removes the WarpEngine containers, volumes, networks, images and data folder from this machine, with a progress notification.
   *
   * Signs out when the local engine was the current host, looks for it again, refreshes everything and reports. With nothing to remove it only says so.
   */
  public async purge(): Promise<void> {
    const plan: PurgePlan = await this.deps.servers.purgePlan()
    if (Servers.isEmpty(plan)) {
      Dialogs.info(t('No WarpEngine container, volume or image on this machine.'))
      return
    }
    if (!(await Dialogs.confirm(ServersController.question(plan), t('Purge')))) return
    const wasCurrent: boolean = this.deps.local.isCurrentHost()
    await Dialogs.progress(t('Purging the local WarpEngine'), async (report) => this.deps.servers.purge(plan, report))
    if (wasCurrent) await this.deps.auth.signOut()
    await this.deps.localEngine.discover()
    await this.deps.refresh.refresh()
    Dialogs.info(t('The local WarpEngine is gone: containers, data, volumes, network and images.'))
  }

  private static question(plan: PurgePlan): string {
    const parts: string[] = [
      t('{0} containers', plan.containers.length), t('{0} volumes', plan.volumes.length),
      t('{0} networks', plan.networks.length), t('{0} images', plan.images.length)
    ]
    const data: string = plan.dataFolder ? ` ${t('and the data folder {0} (the catalog, the releases, the token)', plan.dataFolder)}` : ''
    return t('Remove the local WarpEngine for good: {0}{1}? This cannot be undone.', parts.join(', '), data)
  }
}
