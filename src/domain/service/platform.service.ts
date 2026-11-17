import type { PlatformDescription } from '../model/platform-description.model'
import { Platform } from '../model/platform.model'
import type { PlatformCacheRepository } from '../repository/platform-cache.repository'
import type { ConnectionService } from './connection.service'
import type { HostService } from './host.service'

export class PlatformService {
  private readonly loaded: Map<string, Promise<Platform[]>> = new Map<string, Promise<Platform[]>>()

  public constructor(
    private readonly hosts: HostService,
    private readonly connection: ConnectionService,
    private readonly cache: PlatformCacheRepository
  ) {}

  public async all(refresh: boolean = false): Promise<Platform[]> {
    const host: string = this.hosts.require().url
    if (refresh) this.loaded.delete(host)
    const pending: Promise<Platform[]> = this.loaded.get(host) ?? this.fetch(host)
    this.loaded.set(host, pending)
    return pending
  }

  public async find(name: string | null): Promise<Platform | null> {
    if (!name) return null
    return (await this.all()).find((platform: Platform) => platform.name === name) ?? null
  }

  public async label(name: string): Promise<string> {
    return (await this.find(name).catch(() => null))?.label ?? name
  }

  private async fetch(host: string): Promise<Platform[]> {
    try {
      const fresh: PlatformDescription[] = await this.connection.build().platforms()
      await this.cache.write(host, fresh)
      return fresh.map((description: PlatformDescription) => new Platform(description))
    } catch (error: unknown) {
      const cached: PlatformDescription[] | null = this.cache.read(host)
      if (cached) return cached.map((description: PlatformDescription) => new Platform(description))
      this.loaded.delete(host)
      throw error
    }
  }
}
