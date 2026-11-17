import type { PlatformService } from '../../domain/service/platform.service'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

export class RefreshController {
  public constructor(
    private readonly platforms: PlatformService,
    private readonly projects: ProjectRegistry,
    private readonly states: RemoteStateStore,
    private readonly catalogTree: TreeProvider
  ) {}

  public async refresh(): Promise<void> {
    await this.platforms.all(true).catch(() => undefined)
    await this.projects.refresh()
    await this.states.refresh()
    this.catalogTree.refresh()
  }
}
