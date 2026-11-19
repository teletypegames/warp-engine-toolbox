import { HostUrl, type Host } from '../model/host.model'
import { DomainError, msg } from '../model/message.model'
import type { HostRepository } from '../repository/host.repository'

export class HostService {
  private discovered: Host[] = []

  public constructor(private readonly repository: HostRepository) {}

  public setDiscovered(hosts: readonly Host[]): void {
    this.discovered = hosts.map((host: Host) => HostUrl.host(host.url, host.name))
  }

  public known(): Host[] {
    return this.repository.configuredHosts()
      .filter((host: Host) => typeof host.url === 'string' && host.url.trim().length > 0)
      .map((host: Host) => HostUrl.host(host.url, host.name))
  }

  public current(): Host | null {
    const url: string = HostUrl.normalize(this.repository.configuredUrl())
    if (!url) return null
    return [...this.discovered, ...this.known()].find((host: Host) => host.url === url) ?? HostUrl.host(url)
  }

  public require(): Host {
    const host: Host | null = this.current()
    if (!host) throw new DomainError(msg('No WarpEngine host is set: run "WarpEngine: Set Host…" or set warpengine.url.'))
    return host
  }

  public choices(): Host[] {
    const current: Host | null = this.current()
    const listed: Host[] = [...this.discovered, ...this.known().filter((host: Host) => !this.discovered.some((found: Host) => found.url === host.url))]
    return current && !listed.some((host: Host) => host.url === current.url) ? [current, ...listed] : listed
  }

  public async choose(url: string): Promise<Host | null> {
    const normalized: string = HostUrl.normalize(url)
    if (!this.choices().some((host: Host) => host.url === normalized)) await this.repository.saveHosts([...this.known(), HostUrl.host(normalized)])
    await this.repository.saveUrl(normalized)
    return this.current()
  }

  public async remember(url: string): Promise<Host> {
    const host: Host = HostUrl.host(url)
    if (!this.choices().some((known: Host) => known.url === host.url)) await this.repository.saveHosts([...this.known(), host])
    return host
  }

  public async select(url: string): Promise<Host | null> {
    await this.repository.saveUrl(url)
    return this.current()
  }
}
