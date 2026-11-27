/**
 * The WarpEngine hosts: the current one, the configured and the discovered ones.
 *
 * @module
 */
import { HostUrl, type Host } from '../model/host.model'
import { LocalEngine } from '../model/local-engine.model'
import { DomainError, msg } from '../model/message.model'
import type { HostRepository } from '../repository/host.repository'

/** Keeps track of the current host and the hosts to choose from; stores choices in the user settings. */
export class HostService {
  private discovered: Host[] = []

  /**
   * Creates the service.
   *
   * @param repository - The stored host settings.
   */
  public constructor(private readonly repository: HostRepository) {}

  /**
   * Replaces the hosts found on this machine (a running local engine), which are offered first.
   *
   * @param hosts - The discovered hosts.
   */
  public setDiscovered(hosts: readonly Host[]): void {
    this.discovered = hosts.map((host: Host) => HostUrl.host(host.url, host.name))
  }

  /**
   * Lists the configured hosts with a URL, normalized.
   *
   * @returns The hosts.
   */
  public known(): Host[] {
    return this.repository.configuredHosts()
      .filter((host: Host) => typeof host.url === 'string' && host.url.trim().length > 0)
      .map((host: Host) => HostUrl.host(host.url, host.name))
  }

  /**
   * Gives the host the settings point at, named after a discovered or configured entry when one matches.
   *
   * @returns The host, or `null` when no URL is set.
   */
  public current(): Host | null {
    const url: string = HostUrl.normalize(this.repository.configuredUrl())
    if (!url) return null
    return [...this.discovered, ...this.known()].find((host: Host) => host.url === url) ?? HostUrl.host(url)
  }

  /**
   * Gives the current host.
   *
   * @returns The host.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public require(): Host {
    const host: Host | null = this.current()
    if (!host) throw new DomainError(msg('No WarpEngine host is set: run "WarpEngine: Set Host…" or set warpengine.url.'), 'selectHost')
    return host
  }

  /**
   * Lists the hosts to pick from: discovered, then configured, with the current one first when it is in neither.
   *
   * @returns The hosts without duplicates.
   */
  public choices(): Host[] {
    const current: Host | null = this.current()
    const listed: Host[] = [...this.discovered, ...this.known().filter((host: Host) => !this.discovered.some((found: Host) => found.url === host.url))]
    return current && !listed.some((host: Host) => host.url === current.url) ? [current, ...listed] : listed
  }

  /**
   * Makes a URL the current host, adding it to the configured hosts when it is new; writes the settings.
   *
   * @param url - The host URL; normalized first.
   * @returns The new current host.
   */
  public async choose(url: string): Promise<Host | null> {
    const normalized: string = HostUrl.normalize(url)
    if (!this.choices().some((host: Host) => host.url === normalized)) await this.repository.saveHosts([...this.known(), HostUrl.host(normalized)])
    await this.repository.saveUrl(normalized)
    return this.current()
  }

  /**
   * Adds a URL to the configured hosts when it is not among the choices yet; does not change the current host.
   *
   * @param url - The host URL.
   * @returns The host.
   */
  public async remember(url: string): Promise<Host> {
    const host: Host = HostUrl.host(url)
    if (!this.choices().some((known: Host) => known.url === host.url)) await this.repository.saveHosts([...this.known(), host])
    return host
  }

  /**
   * Tells whether a local engine is among the hosts: one found running on this machine, or a configured or current host on a loopback address.
   *
   * @returns `true` when the hosts have a local engine.
   */
  public hasLocal(): boolean {
    return this.choices().some((host: Host) => LocalEngine.isLoopback(host.url))
  }

  /**
   * Tells whether a host can be changed or removed: it is one of the configured hosts, or the current one that no list holds.
   *
   * @param url - The host URL.
   * @returns `true` for a configured or a current-only host, `false` for one only found on this machine.
   */
  public editable(url: string): boolean {
    const normalized: string = HostUrl.normalize(url)
    const discovered: boolean = this.discovered.some((host: Host) => host.url === normalized)
    return this.known().some((host: Host) => host.url === normalized) || (!discovered && this.current()?.url === normalized)
  }

  /**
   * Changes the address and the name of a configured host (adds it when only the current setting held it); the current host follows it. Writes the settings.
   *
   * @param url - The host's present URL.
   * @param next - The new URL; normalized first.
   * @param name - The new name; when empty, one is made of the URL.
   * @returns The changed host.
   */
  public async update(url: string, next: string, name: string): Promise<Host> {
    const old: string = HostUrl.normalize(url)
    const host: Host = HostUrl.host(next, name.trim())
    const others: Host[] = this.known().filter((known: Host) => known.url !== old && known.url !== host.url)
    await this.repository.saveHosts([...others, host])
    if (HostUrl.normalize(this.repository.configuredUrl()) === old) await this.repository.saveUrl(host.url)
    return host
  }

  /**
   * Removes a host from the configured hosts; when it was the current one, no host is current any more. Writes the settings.
   *
   * @param url - The host URL.
   */
  public async remove(url: string): Promise<void> {
    const normalized: string = HostUrl.normalize(url)
    await this.repository.saveHosts(this.known().filter((host: Host) => host.url !== normalized))
    if (HostUrl.normalize(this.repository.configuredUrl()) === normalized) await this.repository.saveUrl('')
  }

  /**
   * Makes a URL the current host without adding it to the list; writes the settings.
   *
   * @param url - The host URL, stored as given.
   * @returns The new current host.
   */
  public async select(url: string): Promise<Host | null> {
    await this.repository.saveUrl(url)
    return this.current()
  }
}
