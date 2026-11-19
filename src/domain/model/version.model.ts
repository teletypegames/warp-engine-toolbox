/**
 * Software versions, release channels and the next versions to offer.
 *
 * @module
 */
import type { ReleaseChannel } from './catalog.model'

/** Which part of a semantic version to raise. */
export type Bump = 'patch' | 'minor' | 'major'

const BUMPS: readonly Bump[] = ['patch', 'minor', 'major']
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(.*)$/
const PRE_RELEASE = /^(\d+\.\d+\.\d+)-(?:alpha|beta|rc)\.?(\d+)$/i
const RELEASE_FORMAT = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/
const DEV_PREFIX = 'dev-'

/** A software version: semantic versions, pre-releases (`1.2.0-beta.1`) and dev builds (`dev-<n>-<branch>`), with the release candidates offered from it. */
export class Version {
  /** The version text, trimmed and without a leading `v`. */
  public readonly text: string

  /**
   * Parses a version text.
   * @param text - The version, with or without a leading `v`.
   */
  public constructor(text: string) {
    this.text = text.trim().replace(/^v/, '')
  }

  /**
   * Tells whether a text is a valid release version (`X.Y.Z` with an optional pre-release or build suffix).
   * @param text - The candidate version.
   * @returns `true` when the host would accept it as a release version.
   */
  public static isReleaseFormat(text: string): boolean {
    return RELEASE_FORMAT.test(text)
  }

  /**
   * Reads the branch from a dev build version.
   * @param version - A version such as `dev-12-feature-x`.
   * @returns The branch (`feature-x`), or `null` when the version is not a dev build.
   */
  public static devBuildBranch(version: string): string | null {
    return /^dev-\d+(?:\.\d+)*-(.+)$/.exec(version)?.[1] ?? null
  }

  /** Whether this is a dev build version. */
  public get isDev(): boolean {
    return this.text.startsWith(DEV_PREFIX)
  }

  /** The release channel the version belongs to: `dev` for dev builds, `beta` for pre-releases, else `stable`. */
  public get channel(): ReleaseChannel {
    if (this.isDev) return 'dev'
    return /^\d+(\.\d+)*-/.test(this.text) ? 'beta' : 'stable'
  }

  /** The version without its pre-release suffix. */
  public get base(): string {
    return this.text.replace(/-.*$/, '')
  }

  /**
   * Raises one part of the version.
   * @param bump - The part to raise; the lower parts restart at 0.
   * @returns The new version; `1.0.0` when the text is not numeric.
   */
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

  /**
   * Compares the major, minor and patch numbers with another version.
   * @param other - The version to compare with.
   * @returns A negative number when this one is lower, positive when higher, 0 when equal.
   */
  public compare(other: Version): number {
    const mine: number[] = this.parts()
    const theirs: number[] = other.parts()
    for (let index = 0; index < 3; index += 1) {
      const difference: number = (mine[index] ?? 0) - (theirs[index] ?? 0)
      if (difference !== 0) return difference
    }
    return 0
  }

  /**
   * Lists the stable versions to offer for the next release.
   * @returns The patch, minor and major bumps; for a pre-release its base version comes first.
   */
  public stableCandidates(): string[] {
    const base: string = this.releaseBase()
    const bumps: string[] = BUMPS.map((bump: Bump) => new Version(base).bump(bump))
    return this.channel === 'beta' ? [base, ...bumps.filter((version: string) => version !== base)] : bumps
  }

  /**
   * Lists the pre-release versions to offer for the next beta.
   * @returns The next number of the current pre-release, or `-beta.1` of each bump.
   */
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
