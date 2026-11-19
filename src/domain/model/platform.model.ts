/**
 * A platform the host builds for, with defaults applied to its description.
 *
 * @module
 */
import { LuaHeader } from './lua-header.model'
import type { KindDescription, MetadataFormat, PlatformDescription, WebBindingDescription } from './platform-description.model'

const DEFAULT_MARKER = '.woodpecker.yaml'
const DEFAULT_METADATA = 'metadata.json'

/** A platform the host builds for (TIC-80, C64, DOS, …), with defaults applied to its {@link PlatformDescription}. */
export class Platform {
  /**
   * Wraps a description the host sent.
   * @param description - The platform as the host describes it.
   */
  public constructor(public readonly description: PlatformDescription) {}

  /** The platform's id, as written in the CI marker. */
  public get name(): string { return this.description.name }
  /** The platform's human-readable name. */
  public get label(): string { return this.description.label }
  /** The build kinds (artifacts) a release of this platform has. */
  public get kinds(): readonly KindDescription[] { return this.description.kinds }
  /** The web runtimes a build of this platform can be played in. */
  public get web(): readonly WebBindingDescription[] { return this.description.web }
  /** How the project's metadata file is written. */
  public get metadataFormat(): MetadataFormat { return this.description.metadata.format }
  /** The metadata file's path in the project; `metadata.json` unless the platform says otherwise. */
  public get metadataFile(): string { return this.description.metadata.file ?? DEFAULT_METADATA }
  /** The command the CI runs to read the version, if the platform has one. */
  public get versionCommand(): string | null { return this.description.version.command }
  /** Whether the version comes from {@link Platform.versionCommand} instead of the metadata. */
  public get versionFromCommand(): boolean { return this.description.version.source === 'command' }
  /** A separate JSON file that holds the version, or `null` when the metadata holds it. */
  public get versionFile(): string | null { return this.description.version.file ?? null }
  /** The CI builder image the platform's pipeline uses, if any. */
  public get builder(): string | null { return this.description.ci.builder }
  /** The CI file that marks a project of this platform; `.woodpecker.yaml` unless the platform says otherwise. */
  public get markerFile(): string { return this.description.ci.marker?.file ?? DEFAULT_MARKER }
  /** A short description of when the host accepts a release, if it restricts releases. */
  public get releaseRule(): string | null { return this.description.releaseRule }

  /** The link to the platform's documentation, if any. */
  public get docsUrl(): string | null { return this.toolingText('docs') }
  /** The repository New Game starts a project from, if any. */
  public get templateUrl(): string | null { return this.toolingText('template') }
  /** The repository of the platform's demo game, if any. */
  public get demoUrl(): string | null { return this.toolingText('demo') }
  /** The git ref the template and demo are taken from; `master` by default. */
  public get toolingRef(): string { return this.toolingText('ref') ?? 'master' }

  /** The VS Code extensions recommended for projects of this platform, written to `.vscode/extensions.json`. */
  public get recommendedExtensions(): readonly unknown[] {
    const extensions: unknown = this.description.tooling['extensions']
    return Array.isArray(extensions) ? extensions as readonly unknown[] : []
  }

  /** The Lua file that holds the metadata header, taken from the version command, or `null`. */
  public get luaFile(): string | null {
    return LuaHeader.fileFromCommand(this.versionCommand)
  }

  /**
   * Picks the web runtime Play uses by default.
   * @returns The binding marked default, else the first one, or `null` when the platform cannot be played on the web.
   */
  public defaultBinding(): WebBindingDescription | null {
    return this.web.find((binding: WebBindingDescription) => binding.default) ?? this.web[0] ?? null
  }

  /**
   * Finds a build kind by name.
   * @param name - The kind's name.
   * @returns The kind, or `null` when the platform has no such kind.
   */
  public kind(name: string): KindDescription | null {
    return this.kinds.find((kind: KindDescription) => kind.name === name) ?? null
  }

  /**
   * Derives the file extension of a kind's upload from its `NAME-VERSION…` pattern.
   * @param kindName - The kind's name.
   * @returns The extension with its dot (such as `.tic`), or `null` when the kind is unknown or its pattern is not a plain extension.
   */
  public payloadExtension(kindName: string): string | null {
    const extension: string = this.kind(kindName)?.upload.replace(/^NAME-VERSION/, '') ?? ''
    return extension && !extension.includes('-') ? extension : null
  }

  private toolingText(key: string): string | null {
    const value: unknown = this.description.tooling[key]
    return typeof value === 'string' && value.length > 0 ? value : null
  }
}
