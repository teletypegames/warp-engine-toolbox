import { LuaHeader } from './lua-header.model'
import type { KindDescription, MetadataFormat, PlatformDescription, WebBindingDescription } from './platform-description.model'

const DEFAULT_MARKER = '.woodpecker.yaml'
const DEFAULT_METADATA = 'metadata.json'

export class Platform {
  public constructor(public readonly description: PlatformDescription) {}

  public get name(): string { return this.description.name }
  public get label(): string { return this.description.label }
  public get kinds(): readonly KindDescription[] { return this.description.kinds }
  public get web(): readonly WebBindingDescription[] { return this.description.web }
  public get metadataFormat(): MetadataFormat { return this.description.metadata.format }
  public get metadataFile(): string { return this.description.metadata.file ?? DEFAULT_METADATA }
  public get versionCommand(): string | null { return this.description.version.command }
  public get versionFromCommand(): boolean { return this.description.version.source === 'command' }
  public get versionFile(): string | null { return this.description.version.file ?? null }
  public get builder(): string | null { return this.description.ci.builder }
  public get markerFile(): string { return this.description.ci.marker?.file ?? DEFAULT_MARKER }
  public get releaseRule(): string | null { return this.description.releaseRule }

  public get docsUrl(): string | null { return this.toolingText('docs') }
  public get templateUrl(): string | null { return this.toolingText('template') }
  public get demoUrl(): string | null { return this.toolingText('demo') }
  public get toolingRef(): string { return this.toolingText('ref') ?? 'master' }

  public get recommendedExtensions(): readonly unknown[] {
    const extensions: unknown = this.description.tooling['extensions']
    return Array.isArray(extensions) ? extensions as readonly unknown[] : []
  }

  public get luaFile(): string | null {
    return LuaHeader.fileFromCommand(this.versionCommand)
  }

  public defaultBinding(): WebBindingDescription | null {
    return this.web.find((binding: WebBindingDescription) => binding.default) ?? this.web[0] ?? null
  }

  public kind(name: string): KindDescription | null {
    return this.kinds.find((kind: KindDescription) => kind.name === name) ?? null
  }

  public payloadExtension(kindName: string): string | null {
    const extension: string = this.kind(kindName)?.upload.replace(/^NAME-VERSION/, '') ?? ''
    return extension && !extension.includes('-') ? extension : null
  }

  private toolingText(key: string): string | null {
    const value: unknown = this.description.tooling[key]
    return typeof value === 'string' && value.length > 0 ? value : null
  }
}
