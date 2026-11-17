import { LuaHeader, type HeaderLine } from './lua-header.model'
import type { MetadataFormat } from './platform-description.model'

export type MetadataValues = Record<string, unknown>

export class Metadata {
  public constructor(public readonly values: Readonly<MetadataValues>) {}

  public static empty(): Metadata {
    return new Metadata({})
  }

  public static parse(text: string, format: MetadataFormat): Metadata {
    if (format === 'lua') return new Metadata(LuaHeader.parse(text).values())
    if (format === 'json') return new Metadata(Metadata.parseJson(text) ?? {})
    return Metadata.empty()
  }

  public static forCheck(text: string, format: MetadataFormat): Metadata {
    if (format !== 'lua') return Metadata.parse(text, format)
    const lines: readonly HeaderLine[] = LuaHeader.parse(text).lines.filter((entry: HeaderLine) => entry.key !== 'script')
    return new Metadata(Object.fromEntries(lines.map((entry: HeaderLine) => [entry.key, entry.value])))
  }

  public static parseJson(text: string): MetadataValues | null {
    try {
      const parsed: unknown = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? parsed as MetadataValues : {}
    } catch {
      return null
    }
  }

  public static stringify(values: Readonly<MetadataValues>): string {
    return `${JSON.stringify(values, null, 2)}\n`
  }

  public text(key: string): string | null {
    const value: unknown = this.values[key]
    return typeof value === 'string' ? value : null
  }

  public trimmed(key: string): string | null {
    const value: string | undefined = this.text(key)?.trim()
    if (!value) return null
    return value
  }

  public object(key: string): Readonly<MetadataValues> {
    const value: unknown = this.values[key]
    return value && typeof value === 'object' ? value as MetadataValues : {}
  }

  public with(key: string, value: unknown): Metadata {
    return new Metadata({ ...this.values, [key]: value })
  }
}
