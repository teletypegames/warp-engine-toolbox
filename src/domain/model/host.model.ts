/**
 * A WarpEngine host and the rules on host addresses.
 *
 * @module
 */
/** A WarpEngine host the toolbox talks to. */
export interface Host {
  /** The name shown for the host. */
  readonly name: string
  /** The host's base address, without a trailing slash. */
  readonly url: string
}

/** Rules on host addresses. */
export class HostUrl {
  /**
   * An address trimmed and without trailing slashes, the form hosts are stored and compared in.
   *
   * @param url - The address as entered.
   * @returns The normalised address.
   */
  public static normalize(url: string): string {
    return url.trim().replace(/\/+$/, '')
  }

  /**
   * The default name of a host: the host part (and port) of its address.
   *
   * @param url - The address.
   * @returns The host part, or the input unchanged when it is not a URL.
   */
  public static nameOf(url: string): string {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  }

  /**
   * Whether a value is an `http:` or `https:` URL.
   *
   * @param value - The text to check, e.g. an input box's value.
   * @returns `true` for a web address.
   */
  public static isWeb(value: string): boolean {
    try {
      const url: URL = new URL(value.trim())
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }

  /**
   * A {@link Host} from an address and an optional name.
   *
   * @param url - The address; it is normalised with {@link HostUrl.normalize}.
   * @param name - The name; when empty, {@link HostUrl.nameOf} the address is used.
   * @returns The host.
   */
  public static host(url: string, name: string = ''): Host {
    const normalized: string = HostUrl.normalize(url)
    return { name: name || HostUrl.nameOf(normalized), url: normalized }
  }
}
