/**
 * What the current host tells about itself.
 *
 * @module
 */
import type { Software } from '../model/catalog.model'
import type { WellKnown } from '../model/local-engine.model'
import type { DiscoveryRepository } from '../repository/discovery.repository'
import type { HostService } from './host.service'

/** Reads the well-known document of the current host, once per host, to know what it offers. */
export class HostInfoService {
  private readonly known: Map<string, WellKnown | null> = new Map<string, WellKnown | null>()

  /**
   * Creates the service.
   *
   * @param discovery - Probes the host.
   * @param hosts - Gives the current host.
   */
  public constructor(private readonly discovery: DiscoveryRepository, private readonly hosts: HostService) {}

  /**
   * Builds the link to a software's page in the host's web admin; probes the host the first time.
   *
   * @param software - The software.
   * @returns The URL, or `null` when no host is set or the host says it has no web admin.
   */
  public async adminUrl(software: Software): Promise<string | null> {
    const host: string | undefined = this.hosts.current()?.url
    if (!host) return null
    const info: WellKnown | null = await this.info(host)
    if (info?.admin === false) return null
    return `${host.replace(/\/+$/, '')}/admin/softwares/${String(software.id)}`
  }

  /** Drops what was learned about the hosts, so the next call probes again. */
  public forget(): void {
    this.known.clear()
  }

  /**
   * Asks a host about itself (`/.well-known/warp-engine`) now, and keeps the answer for {@link HostInfoService.adminUrl}.
   *
   * @param host - The host URL.
   * @returns What it says, or `null` when it does not answer.
   */
  public async wellKnown(host: string): Promise<WellKnown | null> {
    this.known.delete(host)
    return this.info(host)
  }

  private async info(host: string): Promise<WellKnown | null> {
    if (!this.known.has(host)) this.known.set(host, await this.discovery.probe(host).catch((): null => null))
    return this.known.get(host) ?? null
  }
}
