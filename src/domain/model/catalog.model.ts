/**
 * The catalog data the WarpEngine host sends (softwares, releases, assets, scaffolding) and the rules on releases.
 *
 * @module
 */
/** A file attached to a release on the WarpEngine host, as the admin API sends it. */
export interface ReleaseAsset {
  /** The asset's id on the host. */
  readonly id: number
  /** The asset kind (e.g. `html`, `cart`), one of the platform's kinds. */
  readonly kind: string
  /** The asset's path in the host's release folder. */
  readonly path: string
}

/** The channel a release is published on. */
export type ReleaseChannel = 'stable' | 'beta' | 'dev'

/** A released version of a software in the host's catalog. */
export interface Release {
  /** The release's id on the host. */
  readonly id: number
  /** The id of the {@link Software} it belongs to. */
  readonly softwareId: number
  /** The version string; a `dev-` prefix marks a development build (see {@link Releases.isDev}). */
  readonly version: string
  /** The channel, when the host sends one. */
  readonly channel?: ReleaseChannel
  /** The commit the release was built from, or `null` when unknown. */
  readonly commitSha: string | null
  /** The files attached to the release. */
  readonly assets: readonly ReleaseAsset[]
  /** When the release was created (ISO 8601), or `null`. */
  readonly createdAt: string | null
  /** When the release was last updated (ISO 8601), or `null`. */
  readonly updatedAt?: string | null
}

/** A labelled link shown with a software in the catalog (homepage, source, store page). */
export interface ExternalLink {
  /** The link's id on the host. */
  readonly id: number
  /** The text shown for the link. */
  readonly label: string
  /** The address the link points to. */
  readonly url: string
}

/** A software (game or tool) in the host's catalog. */
export interface Software {
  /** The software's id on the host. */
  readonly id: number
  /** The technical name: a lowercase slug, unique on the host. */
  readonly name: string
  /** The human-readable title. */
  readonly title: string
  /** The platform it is built for (e.g. `tic80`, `c64`). */
  readonly platform: string
  /** The catalog status (see {@link DEFAULT_STATUSES}), or `null` when unset. */
  readonly status: string | null
  /** The category key, or `null` when unset. */
  readonly category: string | null
  /** The author, or `null` when unset. */
  readonly author: string | null
  /** The description, or `null` when unset. */
  readonly desc: string | null
  /** The licence, or `null` when unset. */
  readonly license: string | null
  /** Whether the catalog highlights the software, when the host sends it. */
  readonly highlighted?: boolean
}

/** A field of a {@link Software} the toolbox lets the user edit from the catalog view. */
export type SoftwareField = 'status' | 'category' | 'highlighted' | 'title'

/** A category the host offers for softwares. */
export interface Category {
  /** The category's key, stored on the software. */
  readonly key: string
  /** The text shown for the category. */
  readonly label: string
}

/** Who a token signs in as on the host, as the admin API's `/me` answers. */
export interface Principal {
  /** The account's display label, or `null` when the host gives none. */
  readonly label: string | null
  /** The scopes the token was granted. */
  readonly scopes: readonly string[]
}

/** The git repository the host created when scaffolding a software. */
export interface ScaffoldRepository {
  /** The owner (user or organisation) of the repository. */
  readonly owner: string
  /** The repository's name. */
  readonly name: string
  /** The repository's web page, or `null`. */
  readonly htmlUrl: string | null
  /** The HTTPS clone address, or `null`. */
  readonly cloneUrl: string | null
  /** The SSH clone address, or `null`. */
  readonly sshUrl: string | null
}

/** What the host answers to a {@link ScaffoldRequest}: the software, its repository and its pipeline. */
export interface ScaffoldResult {
  /** The catalog entry created (or found) for the project. */
  readonly software: Software
  /** The repository created for it. */
  readonly repository: ScaffoldRepository
  /** The id of the build pipeline set up for it, or `null` when none was. */
  readonly pipelineId: number | null
  /** Non-fatal problems the host reports. */
  readonly warnings: readonly string[]
}

/** What the toolbox sends to the host to scaffold a software: catalog entry, repository and pipeline. */
export interface ScaffoldRequest {
  /** The technical name (slug). */
  readonly name: string
  /** The human-readable title. */
  readonly title: string
  /** The platform name. */
  readonly platform: string
  /** The category key, or `null` for none. */
  readonly category: string | null
  /** The description. */
  readonly description: string
}

/** The catalog statuses offered when the host does not send its own list. */
export const DEFAULT_STATUSES: readonly string[] = ['released', 'demo', 'development', 'archived']

/** Rules on {@link Release} data. */
export class Releases {
  /**
   * Whether a release is a development build (its version starts with `dev-`).
   *
   * @param release - The release to check.
   * @returns `true` for a development build.
   */
  public static isDev(release: Release): boolean {
    return release.version.startsWith('dev-')
  }

  /**
   * The releases worth listing: every one except the development builds.
   *
   * @param releases - The releases of a software.
   * @returns A new array without the `dev-` releases, in the original order.
   */
  public static listed(releases: readonly Release[]): Release[] {
    return releases.filter((release: Release) => !Releases.isDev(release))
  }
}
