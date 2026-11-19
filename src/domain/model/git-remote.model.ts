export interface GitRemote {
  readonly name: string
  readonly url: string
}

export class GitRemotes {
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
