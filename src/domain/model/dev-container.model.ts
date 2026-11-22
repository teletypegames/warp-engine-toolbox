/**
 * The names a dev container of a WarpEngine project is known by.
 *
 * @module
 */

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set<string>(['127.0.0.1', 'localhost'])
const MAPPED_LOOPBACK = '[::ffff:127.0.0.1]'

/** Where a project keeps its dev container and how a process knows it runs in one. */
export class DevContainer {
  /** The dev container definition, relative to the project folder. */
  public static readonly FILE: string = '.devcontainer/devcontainer.json'
  /** The environment variable the template's `devcontainer.json` sets to `1` inside the container. */
  public static readonly ENV: string = 'WARPENGINE_DEVCONTAINER'

  /**
   * Gives the URL the computer's browser should open for an address of the computer, asked from a dev container
   * window. VS Code forwards a `localhost` or `127.0.0.1` link opened there to the same port of the container, where
   * nothing listens; the IPv4-mapped form of the loopback address is still the computer's loopback but is not forwarded.
   *
   * @param url - An absolute URL.
   * @returns The URL with `[::ffff:127.0.0.1]` for a loopback host; any other URL (or text that is no URL) unchanged.
   */
  public static browserUrl(url: string): string {
    try {
      const parsed: URL = new URL(url)
      if (!LOOPBACK_HOSTS.has(parsed.hostname)) return url
      parsed.hostname = MAPPED_LOOPBACK
      return parsed.toString()
    } catch {
      return url
    }
  }
}
