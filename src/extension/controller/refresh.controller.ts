import type { PlatformService } from '../../domain/service/platform.service'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'
import type { LocalEngineController } from './local-engine.controller'

export interface RefreshDependencies {
  readonly platforms: PlatformService
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly trees: readonly TreeProvider[]
  readonly localEngine: LocalEngineController
}

export class RefreshController {
  public constructor(private readonly deps: RefreshDependencies) {}

  public async refresh(): Promise<void> {
    await this.deps.localEngine.discover().catch(() => null)
    await this.deps.platforms.all(true).catch(() => undefined)
    await this.deps.projects.refresh()
    await this.deps.states.refresh()
    for (const tree of this.deps.trees) tree.refresh()
  }
}
