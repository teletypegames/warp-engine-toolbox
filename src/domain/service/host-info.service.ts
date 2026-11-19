import type { Software } from '../model/catalog.model'
import type { WellKnown } from '../model/local-engine.model'
import type { DiscoveryRepository } from '../repository/discovery.repository'
import type { HostService } from './host.service'

export class HostInfoService {
  private readonly known: Map<string, WellKnown | null> = new Map<string, WellKnown | null>()

  public constructor(private readonly discovery: DiscoveryRepository, private readonly hosts: HostService) {}

  public async adminUrl(software: Software): Promise<string | null> {
    const host: string | undefined = this.hosts.current()?.url
    if (!host) return null
    const info: WellKnown | null = await this.info(host)
    if (info?.admin === false) return null
    return `${host.replace(/\/+$/, '')}/admin/softwares/${String(software.id)}`
  }

  public forget(): void {
    this.known.clear()
  }

  private async info(host: string): Promise<WellKnown | null> {
    if (!this.known.has(host)) this.known.set(host, await this.discovery.probe(host).catch((): null => null))
    return this.known.get(host) ?? null
  }
}
