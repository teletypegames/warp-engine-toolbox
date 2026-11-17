export interface Marker {
  readonly platform: string | null
  readonly name: string | null
  readonly options: Readonly<Record<string, string>>
}

const LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/

export function parseMarker(text: string): Marker {
  const values: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line: string = raw.replace(/\s+#.*$/, '')
    if (line.startsWith(' ') || line.startsWith('\t') || line.startsWith('#')) continue
    const match: RegExpExecArray | null = LINE.exec(line)
    if (!match?.[1] || match[2] === undefined) continue
    values[match[1]] = unquote(match[2])
  }
  const { platform, name, ...options } = values
  return { platform: platform ?? null, name: name ?? null, options }
}

export function isMarker(text: string): boolean {
  const marker: Marker = parseMarker(text)
  return marker.platform !== null && !/^\s*steps\s*:/m.test(text) && !/^\s*pipeline\s*:/m.test(text)
}

export function renderMarker(platform: string, name: string | null, previewUrl: string | null): string {
  const lines: string[] = []
  if (previewUrl) {
    lines.push('# One-line marker: the WarpEngine host serves the full pipeline. Preview it with:')
    lines.push(`#   curl "${previewUrl}"`)
  }
  lines.push(`platform: ${platform}`)
  if (name) lines.push(`name: ${name}`)
  return `${lines.join('\n')}\n`
}

function unquote(value: string): string {
  const match: RegExpExecArray | null = /^(["'])(.*)\1$/.exec(value)
  return match?.[2] ?? value
}
