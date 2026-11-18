import { DomainError, msg } from './message.model'
import { LuaHeader } from './lua-header.model'
import { Metadata, type MetadataValues } from './metadata.model'
import type { MetadataFormat } from './platform-description.model'

export class MetadataDocument {
  public constructor(private readonly text: string, private readonly format: MetadataFormat) {}

  public withVersion(version: string): string {
    if (this.format === 'lua') return LuaHeader.parse(this.text).with('version', version)
    const values: MetadataValues = this.text ? JSON.parse(this.text) as MetadataValues : {}
    values['version'] = version
    return Metadata.stringify(values)
  }

  public static jsonWithVersion(text: string, version: string): string {
    const values: MetadataValues | null = MetadataDocument.parseObject(text)
    if (!values) throw new DomainError(msg('The version file is not valid JSON; fix it in the text editor first.'))
    values['version'] = version
    return `${JSON.stringify(values, null, 2)}\n`
  }

  public withRepository(url: string): string | null {
    if (this.format === 'lua') return LuaHeader.parse(this.text).with('site', url)
    if (this.format !== 'json') return null
    const values: MetadataValues | null = MetadataDocument.parseObject(this.text)
    if (!values) return null
    values['repo'] = url
    values['site'] ??= url
    return Metadata.stringify(values)
  }

  public withPath(path: readonly string[], value: unknown): string {
    const values: MetadataValues | null = Metadata.parseJson(this.text || '{}')
    if (!values) throw new DomainError(msg('metadata.json is not valid JSON; fix it in the text editor first.'))
    MetadataDocument.setPath(values, path, value)
    return Metadata.stringify(values)
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
