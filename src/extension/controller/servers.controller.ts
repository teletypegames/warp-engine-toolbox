import type { PurgePlan } from '../../domain/model/server.model'
import { Servers } from '../../domain/model/server.model'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import type { ServerService } from '../../domain/service/server.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { LocalEngineController } from './local-engine.controller'
import type { RefreshController } from './refresh.controller'

export interface ServersDependencies {
  readonly servers: ServerService
  readonly local: LocalEngineService
  readonly auth: WarpEngineAuthProvider
  readonly localEngine: LocalEngineController
  readonly refresh: RefreshController
}

export class ServersController {
  public constructor(private readonly deps: ServersDependencies) {}

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
