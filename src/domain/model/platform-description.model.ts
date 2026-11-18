export interface KindDescription {
  readonly name: string
  readonly upload: string
  readonly required: boolean
  readonly optional: boolean
  readonly built: boolean
  readonly always: boolean
}

export interface WebParamDescription {
  readonly name: string
  readonly type: string
}

export interface WebBindingDescription {
  readonly key: string
  readonly runtime: string
  readonly label: string | null
  readonly payload: string
  readonly default: boolean
  readonly params: readonly WebParamDescription[]
}

export type MetadataFormat = 'json' | 'lua' | 'custom'

export interface PlatformDescription {
  readonly name: string
  readonly label: string
  readonly kinds: readonly KindDescription[]
  readonly metadata: { readonly format: MetadataFormat; readonly file: string | null; readonly keys: readonly string[] }
  readonly version: { readonly source: 'metadata' | 'command'; readonly command: string | null; readonly file?: string | null }
  readonly releaseRule: string | null
  readonly web: readonly WebBindingDescription[]
  readonly ci: {
    readonly adapter: string
    readonly served: boolean
    readonly marker: { readonly file: string; readonly content: string } | null
    readonly builder: string | null
  }
  readonly tooling: Readonly<Record<string, unknown>>
}
