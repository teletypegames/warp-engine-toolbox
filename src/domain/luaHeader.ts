export interface HeaderLine {
  readonly key: string
  readonly value: string
  readonly line: number
}

export function readLuaHeader(text: string): HeaderLine[] {
  const lines: string[] = text.split(/\r?\n/)
  const header: HeaderLine[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line: string = lines[index] ?? ''
    if (!line.startsWith('--')) break
    const separator: number = line.indexOf(':', 2)
    if (separator < 0) continue
    header.push({ key: line.slice(2, separator).trim().toLowerCase(), value: line.slice(separator + 1).trim(), line: index })
  }
  return header
}

export function luaHeaderValues(text: string): Record<string, string> {
  return Object.fromEntries(readLuaHeader(text).map((entry: HeaderLine) => [entry.key, entry.value]))
}

export function setLuaHeaderValue(text: string, key: string, value: string): string {
  const eol: string = text.includes('\r\n') ? '\r\n' : '\n'
  const lines: string[] = text.split(/\r?\n/)
  const found: HeaderLine | undefined = readLuaHeader(text).find((entry: HeaderLine) => entry.key === key.toLowerCase())
  if (found) {
    const original: string = lines[found.line] ?? ''
    const separator: number = original.indexOf(':', 2)
    lines[found.line] = `${original.slice(0, separator + 1)} ${value}`
  } else {
    const end: number = readLuaHeader(text).reduce((last: number, entry: HeaderLine) => Math.max(last, entry.line + 1), 0)
    lines.splice(end, 0, `-- ${key}: ${value}`)
  }
  return lines.join(eol)
}

export function luaFileFromCommand(command: string | null): string | null {
  if (!command) return null
  const match: RegExpExecArray | null = /([\w./-]+\.lua)\b/.exec(command)
  return match?.[1] ?? null
}
