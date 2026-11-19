/**
 * The WarpEngine Local running on this machine.
 *
 * @module
 */
import { LocalEngine, type WellKnown } from '../model/local-engine.model'
import { DomainError, msg } from '../model/message.model'
import type { DiscoveryRepository } from '../repository/discovery.repository'
import type { LocalEngineRepository } from '../repository/local-engine.repository'
import type { HostService } from './host.service'

/** Discovers the WarpEngine Local on this machine, offers it as a host and finds its admin token. */
export class LocalEngineService {
  private found: LocalEngine | null = null

  /**
   * Creates the service.
   *
   * @param discovery - Probes the engine's URL.
   * @param local - Reads the installation's port and token.
   * @param hosts - Receives the discovered engine as a host choice.
   */
  public constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly local: LocalEngineRepository,
    private readonly hosts: HostService
  ) {}

  /**
   * Gives the local engine the last {@link LocalEngineService.discover} found.
   *
   * @returns The engine, or `null` when none was found.
   */
  public current(): LocalEngine | null {
    return this.found
  }

  /**
   * Tells whether a URL is the discovered local engine.
   *
   * @param url - The host URL.
   * @returns `true` when it is.
   */
  public isLocal(url: string): boolean {
    return this.found !== null && this.found.url === url
  }

  /**
   * Tells whether the current host is the discovered local engine.
   *
   * @returns `true` when it is.
   */
  public isCurrentHost(): boolean {
    return this.isLocal(this.hosts.current()?.url ?? '')
  }

  /**
   * Probes the local port for an engine with the `local` profile, offers it as a discovered host,
   * and makes it the current host when none is set (writes the settings then).
   *
   * @returns The engine, or `null` when none answers.
   */
  public async discover(): Promise<LocalEngine | null> {
    const url: string = LocalEngine.urlFor((await this.local.port()) ?? LocalEngine.DEFAULT_PORT)
    const info: WellKnown | null = await this.discovery.probe(url)
    this.found = info?.profile === 'local' ? new LocalEngine(url, info) : null
    this.hosts.setDiscovered(this.found ? [this.found.host] : [])
    if (this.found && !this.hosts.current()) await this.hosts.select(this.found.url)
    return this.found
  }

  /**
   * Finds the local engine's admin token: the installation's token file, else from the running container.
   *
   * @returns The token.
   * @throws {@link "domain/model/message.model".DomainError} When neither gives one.
   */
  public async token(): Promise<string> {
    const token: string | null = (await this.local.tokenFile()) ?? (await this.local.tokenFromContainer())
    if (!token) throw new DomainError(msg('The local engine\'s token was not found: run its installer again, or "docker exec warp-engine-local bin/warp-engine token".'))
    return token
  }
}
