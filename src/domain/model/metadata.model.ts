/**
 * A project's metadata, read from a JSON file or a Lua header.
 *
 * @module
 */
import { LuaHeader, type HeaderLine } from './lua-header.model'
import type { MetadataFormat } from './platform-description.model'

/** A project's metadata as a key → value record (title, author, desc, version, …). */
export type MetadataValues = Record<string, unknown>

/**
 * A project's metadata, read from its metadata file (`metadata.json`) or its Lua
 * header, depending on the platform's {@link MetadataFormat}. Immutable.
 */
export class Metadata {
  /**
   * Wraps metadata values.
   *
   * @param values - The values by key.
   */
  public constructor(public readonly values: Readonly<MetadataValues>) {}

  /**
   * Metadata with no values.
   *
   * @returns The empty metadata.
   */
  public static empty(): Metadata {
    return new Metadata({})
  }

  /**
   * Reads metadata in a platform's format: a Lua header, or a JSON object; a
   * `custom` format yields empty metadata, as does JSON that does not parse.
   *
   * @param text - The file content.
   * @param format - The platform's metadata format.
   * @returns The metadata.
   */
  public static parse(text: string, format: MetadataFormat): Metadata {
    if (format === 'lua') return new Metadata(LuaHeader.parse(text).values())
    if (format === 'json') return new Metadata(Metadata.parseJson(text) ?? {})
    return Metadata.empty()
  }

  /**
   * Reads metadata for the publish checks: as {@link Metadata.parse}, except that a
   * Lua header's `script` line is left out.
   *
   * @param text - The file content.
   * @param format - The platform's metadata format.
   * @returns The metadata to check.
   */
  public static forCheck(text: string, format: MetadataFormat): Metadata {
    if (format !== 'lua') return Metadata.parse(text, format)
    const lines: readonly HeaderLine[] = LuaHeader.parse(text).lines.filter((entry: HeaderLine) => entry.key !== 'script')
    return new Metadata(Object.fromEntries(lines.map((entry: HeaderLine) => [entry.key, entry.value])))
  }

  /**
   * Parses a JSON metadata file.
   *
   * @param text - The file content.
   * @returns The values; an empty record when the JSON is not an object; `null` when it is not valid JSON.
   */
  public static parseJson(text: string): MetadataValues | null {
    try {
      const parsed: unknown = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? parsed as MetadataValues : {}
    } catch {
      return null
    }
  }

  /**
   * Metadata values as the text of a JSON metadata file: two-space indented, ending with a newline.
   *
   * @param values - The values to write.
   * @returns The file content.
   */
  public static stringify(values: Readonly<MetadataValues>): string {
    return `${JSON.stringify(values, null, 2)}\n`
  }

  /**
   * A string value.
   *
   * @param key - The key.
   * @returns The value, or `null` when it is missing or not a string.
   */
  public text(key: string): string | null {
    const value: unknown = this.values[key]
    return typeof value === 'string' ? value : null
  }

  /**
   * A string value without surrounding whitespace.
   *
   * @param key - The key.
   * @returns The trimmed value, or `null` when it is missing, not a string, or blank.
   */
  public trimmed(key: string): string | null {
    const value: string | undefined = this.text(key)?.trim()
    if (!value) return null
    return value
  }

  /**
   * A nested object value.
   *
   * @param key - The key.
   * @returns The object, or an empty record when it is missing or not an object.
   */
  public object(key: string): Readonly<MetadataValues> {
    const value: unknown = this.values[key]
    return value && typeof value === 'object' ? value as MetadataValues : {}
  }

  /**
   * A copy with one value set.
   *
   * @param key - The key to set.
   * @param value - The new value.
   * @returns New metadata; this one is unchanged.
   */
  public with(key: string, value: unknown): Metadata {
    return new Metadata({ ...this.values, [key]: value })
  }
}
