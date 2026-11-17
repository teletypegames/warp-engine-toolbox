export interface Host {
  readonly name: string
  readonly url: string
}

export class HostUrl {
  public static normalize(url: string): string {
    return url.trim().replace(/\/+$/, '')
  }

  public static nameOf(url: string): string {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  }

  public static isWeb(value: string): boolean {
    try {
      const url: URL = new URL(value.trim())
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }

  public static host(url: string, name: string = ''): Host {
    const normalized: string = HostUrl.normalize(url)
    return { name: name || HostUrl.nameOf(normalized), url: normalized }
  }
}
