export type Bump = 'patch' | 'minor' | 'major'

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(.*)$/

export function bumpVersion(version: string, bump: Bump): string {
  const match: RegExpExecArray | null = SEMVER.exec(version.trim())
  if (!match) {
    const parts: number[] = version.split('.').map((part: string) => Number.parseInt(part, 10))
    if (parts.length === 0 || parts.some((part: number) => Number.isNaN(part))) return '1.0.0'
    return bumpVersion([...parts, 0, 0].slice(0, 3).join('.'), bump)
  }
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  switch (bump) {
    case 'major': return `${String(major + 1)}.0.0`
    case 'minor': return `${String(major)}.${String(minor + 1)}.0`
    case 'patch': return `${String(major)}.${String(minor)}.${String(patch + 1)}`
  }
}

export function compareVersions(left: string, right: string): number {
  const parse = (value: string): number[] => value.replace(/^v/, '').split(/[.+-]/).slice(0, 3).map((part: string) => Number.parseInt(part, 10) || 0)
  const a: number[] = parse(left)
  const b: number[] = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const difference: number = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function isDevVersion(version: string): boolean {
  return version.startsWith('dev-')
}
