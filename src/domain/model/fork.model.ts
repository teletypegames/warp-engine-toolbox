/**
 * What the public catalog (WECP) tells about a software's source and forks, and the rules on cloning and forking it.
 *
 * @module
 */
import { HostUrl } from './host.model'

/** The one cloneable git address of a software, as the public catalog sends it (`software.source`). */
export interface SoftwareSource {
  /** The clone address, usually HTTPS. */
  readonly url: string
  /** An SSH clone address, when the host offers one. */
  readonly sshUrl: string | null
  /** The branch or tag to clone, or `null` for the repository's default branch. */
  readonly ref: string | null
  /** Whether an anonymous `git ls-remote` reached it: `null` when not checked yet. */
  readonly public: boolean | null
}

/** The parent a fork records (`software.forkOf`, and the `fork_of_*` metadata keys). */
export interface ForkOrigin {
  /** The base URL of the parent's engine, without a trailing slash. */
  readonly engine: string
  /** The parent's name on its engine. */
  readonly name: string
  /** The parent's release when it was forked, or `null`. */
  readonly version: string | null
  /** The parent's source address when it was forked, or `null`. */
  readonly repo: string | null
}

/** A software of a host's public catalog, with the fields cloning and forking need. */
export interface PublicSoftware {
  /** The technical name, unique on the host. */
  readonly name: string
  /** The human-readable title. */
  readonly title: string
  /** The author, or `null` when unset. */
  readonly author: string | null
  /** The licence, or `null` when unset. */
  readonly license: string | null
  /** The latest release's version, or `null` when there is none. */
  readonly latestVersion: string | null
  /** The cloneable source, or `null` when the host gives none (an older host, or no source link). */
  readonly source: SoftwareSource | null
  /** Whether the host offers forking it; `false` when the host does not say. */
  readonly forksAllowed: boolean
  /** The parent, when this software is a fork itself. */
  readonly forkOf: ForkOrigin | null
  /** The number of visible forks, or `null` when the host does not count them (it lists no forks either). */
  readonly forksCount: number | null
}

/** A fork of a software as the parent's host lists it (`GET /api/softwares/:name/forks`). */
export interface SoftwareFork {
  /** The base URL of the engine the fork lives on. */
  readonly engine: string
  /** The fork's name on that engine. */
  readonly name: string
  /** The fork's title. */
  readonly title: string
  /** Whether the fork lives on the same engine as its parent. */
  readonly local: boolean
}

/** A git address to clone from and how it is reached. */
export interface CloneAddress {
  /** `SSH` or `HTTPS`. */
  readonly protocol: 'SSH' | 'HTTPS'
  /** The address. */
  readonly url: string
}

const SCP_LIKE = /^[\w.-]+@[\w.-]+:/

/** Rules on {@link PublicSoftware} data: what can be cloned and forked, and from which address. */
export class Forks {
  /**
   * Whether the toolbox offers *Clone…*: the host gave a source.
   *
   * @param software - The public software.
   * @returns `true` when there is a source address.
   */
  public static canClone(software: PublicSoftware): boolean {
    return (software.source?.url.trim() ?? '') !== ''
  }

  /**
   * Whether the toolbox offers *Fork…*: the host allows it and there is a source to clone.
   *
   * @param software - The public software.
   * @returns `true` when forking is allowed.
   */
  public static canFork(software: PublicSoftware): boolean {
    return software.forksAllowed && Forks.canClone(software)
  }

  /**
   * Whether a fork of a software is asked for a licence at Connect: the original has none.
   *
   * @param software - The software being forked.
   * @returns `true` when its licence is empty.
   */
  public static needsLicense(software: PublicSoftware): boolean {
    return (software.license?.trim() ?? '') === ''
  }

  /**
   * Whether the host lists forks: it counts them (WECP `api: 3` and later).
   *
   * @param software - The public software.
   * @returns `true` when the *Forks* node is worth showing.
   */
  public static listsForks(software: PublicSoftware): boolean {
    return software.forksCount !== null
  }

  /**
   * The addresses to clone a source from, SSH first when it offers one.
   *
   * @param source - The source.
   * @returns The SSH address (when given, or when the main address is SSH) and the HTTPS one, in that order.
   */
  public static addresses(source: SoftwareSource): CloneAddress[] {
    const addresses: CloneAddress[] = []
    if (source.sshUrl) addresses.push({ protocol: 'SSH', url: source.sshUrl })
    const main: string = source.url.trim()
    if (Forks.isSsh(main)) addresses.push({ protocol: 'SSH', url: main })
    else if (main) addresses.push({ protocol: 'HTTPS', url: main })
    return addresses
  }

  /**
   * Whether a git address goes over SSH: `ssh://…` or the scp-like `user@host:path`.
   *
   * @param url - The address.
   * @returns `true` for SSH.
   */
  public static isSsh(url: string): boolean {
    return url.startsWith('ssh://') || SCP_LIKE.test(url)
  }

  /**
   * The parent a fork of a software records.
   *
   * @param software - The software being forked.
   * @param engine - The base URL of the engine it is forked from.
   * @returns The origin, with the latest release and the source address of the moment.
   */
  public static originOf(software: PublicSoftware, engine: string): ForkOrigin {
    return { engine: HostUrl.normalize(engine), name: software.name, version: software.latestVersion, repo: software.source?.url ?? null }
  }
}
