/**
 * The platforms of the current host.
 *
 * @module
 */
import type { PlatformDescription } from '../model/platform-description.model'
import { Platform } from '../model/platform.model'
import type { PlatformCacheRepository } from '../repository/platform-cache.repository'
import type { ConnectionService } from './connection.service'
import type { HostService } from './host.service'

/** Loads the platforms of the current host once per host, falling back to the cached copy when the host cannot be reached. */
export class PlatformService {
  private readonly loaded: Map<string, Promise<Platform[]>> = new Map<string, Promise<Platform[]>>()

  /**
   * Creates the service.
   *
   * @param hosts - Gives the current host.
   * @param connection - Gives the build API.
   * @param cache - Remembers the last platforms of each host.
   */
  public constructor(
    private readonly hosts: HostService,
    private readonly connection: ConnectionService,
    private readonly cache: PlatformCacheRepository
  ) {}

  /**
   * Gives the platforms of the current host; fetches them on first use and caches them.
   *
   * @param refresh - `true` fetches again instead of reusing the loaded list.
   * @returns The platforms.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   * @throws The host's error when it cannot be asked and nothing is cached.
   */
  public async all(refresh: boolean = false): Promise<Platform[]> {
    const host: string = this.hosts.require().url
    if (refresh) this.loaded.delete(host)
    const pending: Promise<Platform[]> = this.loaded.get(host) ?? this.fetch(host)
    this.loaded.set(host, pending)
    return pending
  }

  /**
   * Finds a platform by id.
   *
   * @param name - The platform id, or `null`.
   * @returns The platform, or `null` when the name is empty or unknown.
   */
  public async find(name: string | null): Promise<Platform | null> {
    if (!name) return null
    return (await this.all()).find((platform: Platform) => platform.name === name) ?? null
  }

  /**
   * Gives the display label of a platform; never rejects.
   *
   * @param name - The platform id.
   * @returns The label, or the id itself when the platform is unknown or cannot be loaded.
   */
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
