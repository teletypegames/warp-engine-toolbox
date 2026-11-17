import type { ReleaseChannel } from './catalog.model'

export type Bump = 'patch' | 'minor' | 'major'

const BUMPS: readonly Bump[] = ['patch', 'minor', 'major']
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(.*)$/
const PRE_RELEASE = /^(\d+\.\d+\.\d+)-(?:alpha|beta|rc)\.?(\d+)$/i
const RELEASE_FORMAT = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/
const DEV_PREFIX = 'dev-'

export class Version {
  public readonly text: string

  public constructor(text: string) {
    this.text = text.trim().replace(/^v/, '')
  }

  public static isReleaseFormat(text: string): boolean {
    return RELEASE_FORMAT.test(text)
  }

  public static devBuildBranch(version: string): string | null {
    return /^dev-\d+(?:\.\d+)*-(.+)$/.exec(version)?.[1] ?? null
  }

  public get isDev(): boolean {
    return this.text.startsWith(DEV_PREFIX)
  }

  public get channel(): ReleaseChannel {
    if (this.isDev) return 'dev'
    return /^\d+(\.\d+)*-/.test(this.text) ? 'beta' : 'stable'
  }

  public get base(): string {
    return this.text.replace(/-.*$/, '')
  }

  public bump(bump: Bump): string {
    const match: RegExpExecArray | null = SEMVER.exec(this.text)
    if (!match) return this.bumpLoose(bump)
    const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])]
    switch (bump) {
      case 'major': return `${String(major + 1)}.0.0`
      case 'minor': return `${String(major)}.${String(minor + 1)}.0`
      case 'patch': return `${String(major)}.${String(minor)}.${String(patch + 1)}`
    }
  }

  public compare(other: Version): number {
    const mine: number[] = this.parts()
    const theirs: number[] = other.parts()
    for (let index = 0; index < 3; index += 1) {
      const difference: number = (mine[index] ?? 0) - (theirs[index] ?? 0)
      if (difference !== 0) return difference
    }
    return 0
  }

  public stableCandidates(): string[] {
    const base: string = this.releaseBase()
    const bumps: string[] = BUMPS.map((bump: Bump) => new Version(base).bump(bump))
    return this.channel === 'beta' ? [base, ...bumps.filter((version: string) => version !== base)] : bumps
  }

  public betaCandidates(): string[] {
    const match: RegExpExecArray | null = PRE_RELEASE.exec(this.text)
    if (match?.[1] && match[2]) return [`${match[1]}-beta.${String(Number(match[2]) + 1)}`]
    const base: Version = new Version(this.releaseBase())
    return BUMPS.map((bump: Bump) => `${base.bump(bump)}-beta.1`)
  }

  private releaseBase(): string {
    return this.isDev ? '0.0.0' : this.base
  }

  private parts(): number[] {
    return this.text.split(/[.+-]/).slice(0, 3).map((part: string) => Number.parseInt(part, 10) || 0)
  }

  private bumpLoose(bump: Bump): string {
    const parts: number[] = this.text.split('.').map((part: string) => Number.parseInt(part, 10))
    if (parts.some((part: number) => Number.isNaN(part))) return '1.0.0'
    return new Version([...parts, 0, 0].slice(0, 3).join('.')).bump(bump)
  }
}
