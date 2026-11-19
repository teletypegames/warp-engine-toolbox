/**
 * The {@link domain/repository/platform-cache.repository!PlatformCacheRepository} port implemented with a VS Code memento.
 *
 * @module
 */
import type * as vscode from 'vscode'
import type { PlatformDescription } from '../../domain/model/platform-description.model'
import type { PlatformCacheRepository } from '../../domain/repository/platform-cache.repository'

const CACHE_KEY = 'warpengine.platforms'

type Cache = Record<string, PlatformDescription[]>

/**
 * Keeps the last platform list of each host under the `warpengine.platforms` key of a
 * memento, so the platforms are known before the host answers.
 */
export class MementoPlatformCacheRepository implements PlatformCacheRepository {
  /**
   * Creates the cache.
   *
   * @param state - The memento to keep it in, usually the extension's global state.
   */
  public constructor(private readonly state: vscode.Memento) {}

  /**
   * Reads the cached platforms of a host.
   *
   * @param hostUrl - The host URL.
   * @returns The platforms, or `null` when none are cached for it.
   */
  public read(hostUrl: string): PlatformDescription[] | null {
    return this.cache()[hostUrl] ?? null
  }

  /**
   * Replaces the cached platforms of a host, keeping the other hosts.
   *
   * @param hostUrl - The host URL.
   * @param platforms - The platforms the host sent.
   */
  public async write(hostUrl: string, platforms: readonly PlatformDescription[]): Promise<void> {
    await this.state.update(CACHE_KEY, { ...this.cache(), [hostUrl]: platforms })
  }

  private cache(): Cache {
    return this.state.get<Cache>(CACHE_KEY) ?? {}
  }
}
