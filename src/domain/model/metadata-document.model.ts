/**
 * Rewriting a project's metadata file with one value changed.
 *
 * @module
 */
import { DomainError, msg } from './message.model'
import { LuaHeader } from './lua-header.model'
import { Metadata, type MetadataValues } from './metadata.model'
import type { MetadataFormat } from './platform-description.model'
import type { ForkOrigin } from './fork.model'

/** What {@link MetadataDocument.asFork} writes into a fork's metadata. */
export interface ForkRewrite {
  /** The fork's technical name. */
  readonly name: string
  /** The fork's title. */
  readonly title: string
  /** The software it was forked from. */
  readonly origin: ForkOrigin
}

/**
 * The text of a project's metadata file (JSON or a Lua header), rewritten with one value changed.
 *
 * Every method returns the new text and leaves the original untouched; writing it back is the caller's job.
 */
export class MetadataDocument {
  /**
   * Wraps the current text of a metadata file.
   * @param text - The file's current content; an empty string stands for a missing JSON file.
   * @param format - How the file is written, which decides how a value is set.
   */
  public constructor(private readonly text: string, private readonly format: MetadataFormat) {}

  /**
   * Sets the version in the document.
   * @param version - The new version.
   * @returns The text with `version` replaced: the `-- version:` line of a Lua header, or the `version` key of the JSON object.
   * @throws SyntaxError when a non-empty JSON document cannot be parsed.
   */
  public withVersion(version: string): string {
    if (this.format === 'lua') return LuaHeader.parse(this.text).with('version', version)
    const values: MetadataValues = this.text ? JSON.parse(this.text) as MetadataValues : {}
    values['version'] = version
    return Metadata.stringify(values)
  }

  /**
   * Sets the `version` key of a separate JSON version file.
   * @param text - The current content of the version file.
   * @param version - The new version.
   * @returns The JSON text with two-space indentation and a trailing newline.
   * @throws {@link domain/model/message.model!DomainError} when the text is not valid JSON.
   */
  public static jsonWithVersion(text: string, version: string): string {
    const values: MetadataValues | null = MetadataDocument.parseObject(text)
    if (!values) throw new DomainError(msg('The version file is not valid JSON; fix it in the text editor first.'))
    values['version'] = version
    return `${JSON.stringify(values, null, 2)}\n`
  }

  /**
   * Records the repository URL in the document.
   *
   * A Lua header gets it as `site`; a JSON object gets it as `repo`, and as `site` too when that is not set yet.
   * @param url - The repository URL.
   * @returns The new text, or `null` when the format is `custom` or the JSON cannot be parsed.
   */
  public withRepository(url: string): string | null {
    if (this.format === 'lua') return LuaHeader.parse(this.text).with('site', url)
    if (this.format !== 'json') return null
    const values: MetadataValues | null = MetadataDocument.parseObject(this.text)
    if (!values) return null
    values['repo'] = url
    values['site'] ??= url
    return Metadata.stringify(values)
  }

  /**
   * Turns the document of a cloned software into its fork's: the new `name` and `title`, no `repo` (the fork gets its
   * own at Connect), and the parent in the flat `fork_of_engine`, `fork_of_name`, `fork_of_version` and `fork_of_repo`
   * keys (a missing version or repository drops its key). An earlier parent, flat or as a nested `fork_of`, is replaced.
   * @param fork - The fork's name and title and its parent.
   * @returns The new text, or `null` when the format is `custom` or the JSON cannot be parsed.
   */
  public asFork(fork: ForkRewrite): string | null {
    const values: [string, string | null][] = [
      ['name', fork.name], ['title', fork.title], ['repo', null], ['fork_of_engine', fork.origin.engine], ['fork_of_name', fork.origin.name],
      ['fork_of_version', fork.origin.version], ['fork_of_repo', fork.origin.repo]
    ]
    if (this.format === 'lua') return MetadataDocument.luaWith(this.text, values)
    if (this.format !== 'json') return null
    const parsed: MetadataValues | null = MetadataDocument.parseObject(this.text)
    if (!parsed) return null
    Reflect.deleteProperty(parsed, 'fork_of')
    for (const [key, value] of values) MetadataDocument.assign(parsed, key, value ?? undefined)
    return Metadata.stringify(parsed)
  }

  /**
   * Sets the licence in the document: the `license` key of the JSON object, or the `-- license:` line of a Lua header.
   * @param license - The licence identifier, such as `MIT`.
   * @returns The new text, or `null` when the format is `custom` or the JSON cannot be parsed.
   */
  public withLicense(license: string): string | null {
    if (this.format === 'lua') return LuaHeader.parse(this.text).with('license', license)
    if (this.format !== 'json') return null
    const values: MetadataValues | null = MetadataDocument.parseObject(this.text)
    if (!values) return null
    values['license'] = license
    return Metadata.stringify(values)
  }

  /**
   * Sets a nested value of a JSON metadata document, as the metadata form edits it.
   *
   * An empty value (`''`, `null` or `undefined`) removes the key, and objects left empty are removed with it.
   * @param path - The keys from the root down to the value.
   * @param value - The new value.
   * @returns The new JSON text.
   * @throws {@link domain/model/message.model!DomainError} when the current text is not valid JSON.
   */
  public withPath(path: readonly string[], value: unknown): string {
    const values: MetadataValues | null = Metadata.parseJson(this.text || '{}')
    if (!values) throw new DomainError(msg('metadata.json is not valid JSON; fix it in the text editor first.'))
    MetadataDocument.setPath(values, path, value)
    return Metadata.stringify(values)
  }

  private static luaWith(text: string, values: readonly (readonly [string, string | null])[]): string {
    return values.reduce((current: string, [key, value]) => value === null ? LuaHeader.parse(current).without(key) : LuaHeader.parse(current).with(key, value), text)
  }

  private static parseObject(text: string): MetadataValues | null {
    try {
      return JSON.parse(text) as MetadataValues
    } catch {
      return null
    }
  }

  private static setPath(target: MetadataValues, path: readonly string[], value: unknown): void {
    const [head, ...rest] = path
    if (head === undefined) return
    if (rest.length === 0) {
      MetadataDocument.assign(target, head, MetadataDocument.isEmpty(value) ? undefined : value)
      return
    }
    const child: unknown = target[head]
    const next: MetadataValues = child && typeof child === 'object' ? child as MetadataValues : {}
    MetadataDocument.setPath(next, rest, value)
    MetadataDocument.assign(target, head, Object.keys(next).length === 0 ? undefined : next)
  }

  private static assign(target: MetadataValues, key: string, value: unknown): void {
    if (value === undefined) Reflect.deleteProperty(target, key)
    else target[key] = value
  }

  private static isEmpty(value: unknown): boolean {
    return value === '' || value === null || value === undefined
  }
}
