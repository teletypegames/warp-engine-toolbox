import { LocalEngine, type WellKnown } from '../model/local-engine.model'
import { DomainError, msg } from '../model/message.model'
import type { DiscoveryRepository } from '../repository/discovery.repository'
import type { LocalEngineRepository } from '../repository/local-engine.repository'
import type { HostService } from './host.service'

export class LocalEngineService {
  private found: LocalEngine | null = null

  public constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly local: LocalEngineRepository,
    private readonly hosts: HostService
  ) {}

  public current(): LocalEngine | null {
    return this.found
  }

  public isLocal(url: string): boolean {
    return this.found !== null && this.found.url === url
  }

  public async discover(): Promise<LocalEngine | null> {
    const url: string = LocalEngine.urlFor((await this.local.port()) ?? LocalEngine.DEFAULT_PORT)
    const info: WellKnown | null = await this.discovery.probe(url)
    this.found = info?.profile === 'local' ? new LocalEngine(url, info) : null
    this.hosts.setDiscovered(this.found ? [this.found.host] : [])
    if (this.found && !this.hosts.current()) await this.hosts.select(this.found.url)
    return this.found
  }

  public async token(): Promise<string> {
    const token: string | null = (await this.local.tokenFile()) ?? (await this.local.tokenFromContainer())
    if (!token) throw new DomainError(msg('The local engine\'s token was not found: run its installer again, or "docker exec warp-engine-local bin/warp-engine token".'))
    return token
  }
}
