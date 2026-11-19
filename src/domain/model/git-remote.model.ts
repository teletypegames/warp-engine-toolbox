/**
 * A git remote and how its address is shown.
 *
 * @module
 */
/** A remote of a git repository. */
export interface GitRemote {
  /** The remote's name (e.g. `origin`). */
  readonly name: string
  /** The remote's fetch address, possibly with credentials in it. */
  readonly url: string
}

/** Rules on {@link GitRemote} data. */
export class GitRemotes {
  /**
   * A remote address safe to show: the user name and password removed from a URL.
   *
   * @param url - The remote's address.
   * @returns The address without credentials, or the input unchanged when it is not a URL (e.g. an scp-style SSH address).
   */
  public static display(url: string): string {
    try {
      const parsed: URL = new URL(url)
      parsed.username = ''
      parsed.password = ''
      return parsed.toString()
    } catch {
      return url
    }
  }
}
