/**
 * Port to the cached platform descriptions.
 *
 * @module
 */
import type { PlatformDescription } from '../model/platform-description.model'

/** Port to the platform descriptions remembered per host, so the toolbox works before the host answers. */
export interface PlatformCacheRepository {
  /**
   * Reads the cached platforms of a host.
   *
   * @param hostUrl - The host URL the cache is keyed by.
   * @returns The platforms, or `null` when nothing is cached for that host.
   */
  read(hostUrl: string): PlatformDescription[] | null
  /**
   * Caches the platforms of a host, replacing the earlier entry.
   *
   * @param hostUrl - The host URL the cache is keyed by.
   * @param platforms - The platforms to remember.
   */
  write(hostUrl: string, platforms: readonly PlatformDescription[]): Promise<void>
}
