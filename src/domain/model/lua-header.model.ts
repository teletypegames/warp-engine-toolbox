export interface HeaderLine {
  readonly key: string
  readonly value: string
  readonly line: number
}

const SEPARATOR_FROM = 2

export class LuaHeader {
  private constructor(private readonly text: string, public readonly lines: readonly HeaderLine[]) {}

  public static parse(text: string): LuaHeader {
    return new LuaHeader(text, LuaHeader.read(text.split(/\r?\n/)))
  }

  public static fileFromCommand(command: string | null): string | null {
    if (!command) return null
    return /([\w./-]+\.lua)\b/.exec(command)?.[1] ?? null
  }

  public values(): Record<string, string> {
    return Object.fromEntries(this.lines.map((entry: HeaderLine) => [entry.key, entry.value]))
  }

  public line(key: string): HeaderLine | null {
    return this.lines.find((entry: HeaderLine) => entry.key === key.toLowerCase()) ?? null
  }

  public with(key: string, value: string): string {
    const eol: string = this.text.includes('\r\n') ? '\r\n' : '\n'
    const lines: string[] = this.text.split(/\r?\n/)
    const found: HeaderLine | null = this.line(key)
    if (found) lines[found.line] = LuaHeader.replaceValue(lines[found.line] ?? '', value)
    else lines.splice(this.end(), 0, `-- ${key}: ${value}`)
    return lines.join(eol)
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
