import * as vscode from 'vscode'
import type { PlatformDescription } from '../domain/types'
import type { Hosts } from './hosts'

const CACHE_KEY = 'warpengine.platforms'

export class Platforms {
  private readonly loaded = new Map<string, Promise<PlatformDescription[]>>()

  public constructor(private readonly state: vscode.Memento, private readonly hosts: Hosts) {}

  public async all(refresh: boolean = false): Promise<PlatformDescription[]> {
    const host: string = this.hosts.require().url
    if (refresh) this.loaded.delete(host)
    let pending: Promise<PlatformDescription[]> | undefined = this.loaded.get(host)
    if (!pending) {
      pending = this.fetch(host)
      this.loaded.set(host, pending)
    }
    return pending
  }

  public async find(name: string | null): Promise<PlatformDescription | null> {
    if (!name) return null
    return (await this.all()).find((platform: PlatformDescription) => platform.name === name) ?? null
  }

  private async fetch(host: string): Promise<PlatformDescription[]> {
    const cache: Record<string, PlatformDescription[]> = this.state.get<Record<string, PlatformDescription[]>>(CACHE_KEY) ?? {}
    try {
      const platforms: PlatformDescription[] = await this.hosts.client().platforms()
      await this.state.update(CACHE_KEY, { ...cache, [host]: platforms })
      return platforms
    } catch (error: unknown) {
      const cached: PlatformDescription[] | undefined = cache[host]
      if (cached) return cached
      this.loaded.delete(host)
      throw error
    }
  }
}
