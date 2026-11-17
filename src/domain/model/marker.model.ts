const LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/
const PREVIEW_COMMENT = '# One-line marker: the WarpEngine host serves the full pipeline. Preview it with:'

export class Marker {
  public constructor(
    public readonly platform: string | null,
    public readonly name: string | null,
    public readonly options: Readonly<Record<string, string>>
  ) {}

  public static parse(text: string): Marker {
    const values: Record<string, string> = {}
    for (const raw of text.split(/\r?\n/)) Marker.readLine(raw, values)
    const { platform, name, ...options } = values
    return new Marker(platform ?? null, name ?? null, options)
  }

  public static isMarker(text: string): boolean {
    return Marker.parse(text).platform !== null && !/^\s*steps\s*:/m.test(text) && !/^\s*pipeline\s*:/m.test(text)
  }

  public static render(platform: string, name: string | null, previewUrl: string | null): string {
    const lines: string[] = previewUrl ? [PREVIEW_COMMENT, `#   curl "${previewUrl}"`] : []
    lines.push(`platform: ${platform}`)
    if (name) lines.push(`name: ${name}`)
    return `${lines.join('\n')}\n`
  }

  private static readLine(raw: string, values: Record<string, string>): void {
    const line: string = raw.replace(/\s+#.*$/, '')
    if (line.startsWith(' ') || line.startsWith('\t') || line.startsWith('#')) return
    const match: RegExpExecArray | null = LINE.exec(line)
    if (!match?.[1] || match[2] === undefined) return
    values[match[1]] = Marker.unquote(match[2])
  }

  private static unquote(value: string): string {
    return /^(["'])(.*)\1$/.exec(value)?.[2] ?? value
  }
}
