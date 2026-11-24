/**
 * A platform as the host's admin API describes it: build kinds, metadata, version source, web runtimes, CI and tooling.
 *
 * @module
 */
/** A build kind of a platform: one artifact a release can carry. */
export interface KindDescription {
  /** The kind's name. */
  readonly name: string
  /** The file-name pattern of the upload, such as `NAME-VERSION.tic`. */
  readonly upload: string
  /** Whether a release must carry this kind. */
  readonly required: boolean
  /** Whether the kind may be left out of a release. */
  readonly optional: boolean
  /** Whether the CI builds this kind (rather than it being uploaded by hand). */
  readonly built: boolean
  /** Whether the kind is produced on every build. */
  readonly always: boolean
}

/** A parameter a web runtime binding accepts. */
export interface WebParamDescription {
  /** The parameter's name. */
  readonly name: string
  /** The parameter's type. */
  readonly type: string
}

/** A web runtime a platform's builds can be played in. */
export interface WebBindingDescription {
  /** The binding's key. */
  readonly key: string
  /** The runtime recipe the host serves. */
  readonly runtime: string
  /** The binding's human-readable name, if any. */
  readonly label: string | null
  /** The kind whose artifact the runtime loads. */
  readonly payload: string
  /** Whether this is the platform's default runtime. */
  readonly default: boolean
  /** The parameters the runtime accepts. */
  readonly params: readonly WebParamDescription[]
}

/** A key of the CI marker besides `platform` and `name`, as the host describes it. */
export interface MarkerOptionDescription {
  /** The key, such as `release`, `app` or `build`. */
  readonly name: string
  /** The values the key takes, such as `tag` and `push`. */
  readonly values: readonly string[]
  /** What the key changes, in the host's words. */
  readonly description: string
}

/** A variant of a platform (such as `cli` or `gui`), picked by an `app:` line in the marker. */
export interface AppDescription {
  /** The variant's name. */
  readonly name: string
  /** Whether this is the variant a marker without `app:` builds. */
  readonly default: boolean
  /** The marker line that picks it, such as `app: gui`. */
  readonly marker: string
  /** The build kinds a release of this variant has. */
  readonly kinds: readonly KindDescription[]
}

/** How a project's metadata file is written: a JSON object, a Lua comment header, or a custom format the toolbox cannot edit. */
export type MetadataFormat = 'json' | 'lua' | 'custom'

/** A platform as the host describes it; {@link domain/model/platform.model!Platform} wraps it with defaults. */
export interface PlatformDescription {
  /** The platform's id. */
  readonly name: string
  /** The platform's human-readable name. */
  readonly label: string
  /** The build kinds a release has. */
  readonly kinds: readonly KindDescription[]
  /** The variants, the default first; empty or missing for a platform without variants (or an older host). */
  readonly apps?: readonly AppDescription[]
  /** The CI marker keys besides `platform` and `name`; missing when the host is older and does not describe them. */
  readonly options?: readonly MarkerOptionDescription[]
  /** The metadata file: its format, its path (`null` for the default) and the keys it holds. */
  readonly metadata: {
    /** How the file is written. */
    readonly format: MetadataFormat
    /** The file's path in the project, or `null` for `metadata.json`. */
    readonly file: string | null
    /** The keys the file holds. */
    readonly keys: readonly string[]
  }
  /** Where the version comes from: the metadata or a command, with the command and an optional separate version file. */
  readonly version: {
    /** Whether the version is read from the metadata or from a command. */
    readonly source: 'metadata' | 'command'
    /** The command the CI runs to read the version, if any. */
    readonly command: string | null
    /** A separate JSON file that holds the version, if any. */
    readonly file?: string | null
  }
  /** When the host accepts a release, if it restricts releases. */
  readonly releaseRule: string | null
  /** The web runtimes builds can be played in. */
  readonly web: readonly WebBindingDescription[]
  /** The CI side: the adapter, whether the host serves the CI config, the marker file and its content, and the builder image. */
  readonly ci: {
    /** The CI system the host drives, such as Woodpecker. */
    readonly adapter: string
    /** Whether the host serves the pipeline config itself. */
    readonly served: boolean
    /** The marker file the project carries and its content, or `null` for the default. */
    readonly marker: {
      /** The marker file's path. */
      readonly file: string
      /** The marker file's content. */
      readonly content: string
    } | null
    /** The builder image the pipeline uses, if any. */
    readonly builder: string | null
  }
  /** Free-form tooling links and settings: `docs`, `template`, `demo`, `ref`, `extensions`. */
  readonly tooling: Readonly<Record<string, unknown>>
}
