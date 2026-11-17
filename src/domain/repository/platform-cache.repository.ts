import type { PlatformDescription } from '../model/platform-description.model'

export interface PlatformCacheRepository {
  read(hostUrl: string): PlatformDescription[] | null
  write(hostUrl: string, platforms: readonly PlatformDescription[]): Promise<void>
}
