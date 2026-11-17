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

export type Channel = 'stable' | 'beta' | 'dev'

const PRE_RELEASE = /^(\d+\.\d+\.\d+)-(?:alpha|beta|rc)\.?(\d+)$/i

export function channelOf(version: string): Channel {
  if (version.startsWith('dev-')) return 'dev'
  return /^\d+(\.\d+)*-/.test(version.replace(/^v/, '')) ? 'beta' : 'stable'
}

export function baseVersion(version: string): string {
  return version.replace(/^v/, '').replace(/-.*$/, '')
}

export function stableCandidates(current: string): string[] {
  const clean: string = current.replace(/^v/, '')
  const base: string = isDevVersion(clean) ? '0.0.0' : baseVersion(clean)
  const bumps: string[] = (['patch', 'minor', 'major'] as const).map((bump: Bump) => bumpVersion(base, bump))
  return channelOf(clean) === 'beta' ? [base, ...bumps.filter((version: string) => version !== base)] : bumps
}

export function betaCandidates(current: string): string[] {
  const clean: string = current.replace(/^v/, '')
  const match: RegExpExecArray | null = PRE_RELEASE.exec(clean)
  if (match?.[1] && match[2]) return [`${match[1]}-beta.${String(Number(match[2]) + 1)}`]
  const base: string = isDevVersion(clean) ? '0.0.0' : baseVersion(clean)
  return (['patch', 'minor', 'major'] as const).map((bump: Bump) => `${bumpVersion(base, bump)}-beta.1`)
}

export function devBuildBranch(version: string): string | null {
  return /^dev-\d+(?:\.\d+)*-(.+)$/.exec(version)?.[1] ?? null
}
