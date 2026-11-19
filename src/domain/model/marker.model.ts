/**
 * The one-line pipeline marker in `.woodpecker.yaml`.
 *
 * @module
 */
const LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/
const PREVIEW_COMMENT = '# One-line marker: the WarpEngine host serves the full pipeline. Preview it with:'

/**
 * The pipeline marker: a short `.woodpecker.yaml` naming only the platform (and
 * optionally the name), for which the WarpEngine host serves the full pipeline.
 */
export class Marker {
  /**
   * Creates a marker from its values.
   *
   * @param platform - The `platform:` value, or `null` when missing.
   * @param name - The `name:` value, or `null` when missing.
   * @param options - Every other top-level key and its value.
   */
  public constructor(
    /** The platform the host builds for, or `null` when missing. */
    public readonly platform: string | null,
    /** The software name, or `null` when missing. */
    public readonly name: string | null,
    /** Every other top-level key and its value. */
    public readonly options: Readonly<Record<string, string>>
  ) {}

  /**
   * Reads the top-level `key: value` lines of a marker file; indented lines and
   * comments are skipped and quotes around values removed.
   *
   * @param text - The file content.
   * @returns The marker; its platform is `null` when the file names none.
   */
  public static parse(text: string): Marker {
    const values: Record<string, string> = {}
    for (const raw of text.split(/\r?\n/)) Marker.readLine(raw, values)
    const { platform, name, ...options } = values
    return new Marker(platform ?? null, name ?? null, options)
  }

  /**
   * Whether a pipeline file is a marker: it names a platform and has no `steps:`
   * or `pipeline:` of its own.
   *
   * @param text - The file content.
   * @returns `true` for a marker.
   */
  public static isMarker(text: string): boolean {
    return Marker.parse(text).platform !== null && !/^\s*steps\s*:/m.test(text) && !/^\s*pipeline\s*:/m.test(text)
  }

  /**
   * The text of a new marker file.
   *
   * @param platform - The platform name.
   * @param name - The software name, or `null` to leave it out.
   * @param previewUrl - The host address that serves the full pipeline, written as a `curl` comment; `null` for none.
   * @returns The file content, ending with a newline.
   */
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
