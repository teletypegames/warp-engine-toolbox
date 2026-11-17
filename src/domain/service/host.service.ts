import { HostUrl, type Host } from '../model/host.model'
import { DomainError, msg } from '../model/message.model'
import type { HostRepository } from '../repository/host.repository'

export class HostService {
  public constructor(private readonly repository: HostRepository) {}

  public known(): Host[] {
    return this.repository.configuredHosts()
      .filter((host: Host) => typeof host.url === 'string' && host.url.trim().length > 0)
      .map((host: Host) => HostUrl.host(host.url, host.name))
  }

  public current(): Host | null {
    const url: string = HostUrl.normalize(this.repository.configuredUrl())
    if (!url) return null
    return this.known().find((host: Host) => host.url === url) ?? HostUrl.host(url)
  }

  public require(): Host {
    const host: Host | null = this.current()
    if (!host) throw new DomainError(msg('No WarpEngine host is set: run "WarpEngine: Set Host…" or set warpengine.url.'))
    return host
  }

  public choices(): Host[] {
    const current: Host | null = this.current()
    const known: Host[] = this.known()
    return current && !known.some((host: Host) => host.url === current.url) ? [current, ...known] : known
  }

  public async choose(url: string): Promise<Host | null> {
    const normalized: string = HostUrl.normalize(url)
    if (!this.choices().some((host: Host) => host.url === normalized)) await this.repository.saveHosts([...this.known(), HostUrl.host(normalized)])
    await this.repository.saveUrl(normalized)
    return this.current()
  }

  public async select(url: string): Promise<Host | null> {
    await this.repository.saveUrl(url)
    return this.current()
  }
}
