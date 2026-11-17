import type * as vscode from 'vscode'
import type { PlatformDescription } from '../../domain/model/platform-description.model'
import type { PlatformCacheRepository } from '../../domain/repository/platform-cache.repository'

const CACHE_KEY = 'warpengine.platforms'

type Cache = Record<string, PlatformDescription[]>

export class MementoPlatformCacheRepository implements PlatformCacheRepository {
  public constructor(private readonly state: vscode.Memento) {}

  public read(hostUrl: string): PlatformDescription[] | null {
    return this.cache()[hostUrl] ?? null
  }

  public async write(hostUrl: string, platforms: readonly PlatformDescription[]): Promise<void> {
    await this.state.update(CACHE_KEY, { ...this.cache(), [hostUrl]: platforms })
  }

  private cache(): Cache {
    return this.state.get<Cache>(CACHE_KEY) ?? {}
  }
}
