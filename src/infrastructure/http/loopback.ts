/**
 * Loopback addresses as this process reaches them: inside a dev container the computer's loopback is `host.docker.internal`.
 *
 * @module
 */
import { DevContainer } from '../../domain/model/dev-container.model'

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set<string>(['127.0.0.1', 'localhost', '[::1]'])
const DOCKER_HOST_NAME = 'host.docker.internal'
const REMOTE_CONTAINERS = 'REMOTE_CONTAINERS'

/**
 * Rewrites the loopback addresses of the computer (a WarpEngine Local engine, a local host) for a process in a dev
 * container, where `127.0.0.1` is the container itself; outside a container every URL stays as it is.
 */
export class Loopback {
  /**
   * Tells whether this process runs in a dev container: the template's variable or the one the Dev Containers extension sets.
   *
   * @returns `true` inside a dev container.
   */
  public static inDevContainer(): boolean {
    return process.env[DevContainer.ENV] === '1' || process.env[REMOTE_CONTAINERS] === 'true'
  }

  /**
   * Gives the URL this process reaches an address at.
   *
   * @param url - An absolute URL.
   * @returns The URL with `host.docker.internal` for a loopback host inside a dev container; otherwise (or when it is no URL) unchanged.
   */
  public static reach(url: string): string {
    if (!Loopback.inDevContainer()) return url
    try {
      const parsed: URL = new URL(url)
      if (!LOOPBACK_HOSTS.has(parsed.hostname)) return url
      parsed.hostname = DOCKER_HOST_NAME
      return parsed.toString()
    } catch {
      return url
    }
  }
}
