/**
 * The `-- key: value` metadata header of a Lua cartridge.
 *
 * @module
 */
/** One `-- key: value` line of a Lua header. */
export interface HeaderLine {
  /** The key, lowercased. */
  readonly key: string
  /** The value, trimmed. */
  readonly value: string
  /** The zero-based line number in the file. */
  readonly line: number
}

const SEPARATOR_FROM = 2

/**
 * The metadata header at the top of a Lua cartridge (TIC-80 style): the leading
 * `-- key: value` comment lines.
 */
export class LuaHeader {
  private constructor(
    private readonly text: string,
    /** The header's `-- key: value` lines, in file order. */
    public readonly lines: readonly HeaderLine[]
  ) {}

  /**
   * Reads the header of a Lua file: the `-- key: value` lines of its leading comment block.
   *
   * @param text - The whole file content.
   * @returns The header, keeping the text so it can be rewritten.
   */
  public static parse(text: string): LuaHeader {
    return new LuaHeader(text, LuaHeader.read(text.split(/\r?\n/)))
  }

  /**
   * The `.lua` file a platform's version command reads, taken from the command line.
   *
   * @param command - The command, or `null`.
   * @returns The first `*.lua` path in it, or `null` when there is none.
   */
  public static fileFromCommand(command: string | null): string | null {
    if (!command) return null
    return /([\w./-]+\.lua)\b/.exec(command)?.[1] ?? null
  }

  /**
   * The header as a key → value record.
   *
   * @returns The values by lowercased key; a later duplicate key wins.
   */
  public values(): Record<string, string> {
    return Object.fromEntries(this.lines.map((entry: HeaderLine) => [entry.key, entry.value]))
  }

  /**
   * The header line of a key.
   *
   * @param key - The key, in any case.
   * @returns The first line with that key, or `null`.
   */
  public line(key: string): HeaderLine | null {
    return this.lines.find((entry: HeaderLine) => entry.key === key.toLowerCase()) ?? null
  }

  /**
   * The file text with one header value set: the existing line's value is replaced,
   * or a new `-- key: value` line is added after the header. Line endings are kept.
   *
   * @param key - The key to set.
   * @param value - The new value.
   * @returns The whole new file content.
   */
  public with(key: string, value: string): string {
    const eol: string = this.text.includes('\r\n') ? '\r\n' : '\n'
    const lines: string[] = this.text.split(/\r?\n/)
    const found: HeaderLine | null = this.line(key)
    if (found) lines[found.line] = LuaHeader.replaceValue(lines[found.line] ?? '', value)
    else lines.splice(this.end(), 0, `-- ${key}: ${value}`)
    return lines.join(eol)
  }

  /**
   * The file text without the header line of a key. Line endings are kept.
   *
   * @param key - The key to remove, in any case.
   * @returns The whole new file content; the text unchanged when the header has no such line.
   */
  public without(key: string): string {
    const found: HeaderLine | null = this.line(key)
    if (!found) return this.text
    const eol: string = this.text.includes('\r\n') ? '\r\n' : '\n'
    return this.text.split(/\r?\n/).filter((_line: string, index: number) => index !== found.line).join(eol)
  }

  private end(): number {
    return this.lines.reduce((last: number, entry: HeaderLine) => Math.max(last, entry.line + 1), 0)
  }

  private static replaceValue(original: string, value: string): string {
    return `${original.slice(0, original.indexOf(':', SEPARATOR_FROM) + 1)} ${value}`
  }

  private static read(lines: readonly string[]): HeaderLine[] {
    const header: HeaderLine[] = []
    for (const [index, line] of lines.entries()) {
      if (!line.startsWith('--')) break
      const separator: number = line.indexOf(':', SEPARATOR_FROM)
      if (separator < 0) continue
      header.push({ key: line.slice(SEPARATOR_FROM, separator).trim().toLowerCase(), value: line.slice(separator + 1).trim(), line: index })
    }
    return header
  }
}
