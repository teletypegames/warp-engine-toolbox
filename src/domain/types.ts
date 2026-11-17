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

export interface PlatformDescription {
  readonly name: string
  readonly label: string
  readonly kinds: readonly KindDescription[]
  readonly metadata: { readonly format: 'json' | 'lua' | 'custom'; readonly file: string | null; readonly keys: readonly string[] }
  readonly version: { readonly source: 'metadata' | 'command'; readonly command: string | null }
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

export type ProblemLevel = 'error' | 'warning'

export interface PublishProblem {
  readonly field: string
  readonly message: string
  readonly level: ProblemLevel
}

export interface PublishCheck {
  readonly ok: boolean
  readonly problems: readonly PublishProblem[]
}

export interface ReleaseAsset {
  readonly id: number
  readonly kind: string
  readonly path: string
}

export interface Release {
  readonly id: number
  readonly softwareId: number
  readonly version: string
  readonly channel?: 'stable' | 'beta' | 'dev'
  readonly commitSha: string | null
  readonly assets: readonly ReleaseAsset[]
  readonly createdAt: string | null
  readonly updatedAt?: string | null
}

export interface ExternalLink {
  readonly id: number
  readonly label: string
  readonly url: string
}

export interface Software {
  readonly id: number
  readonly name: string
  readonly title: string
  readonly platform: string
  readonly status: string | null
  readonly category: string | null
  readonly author: string | null
  readonly desc: string | null
  readonly license: string | null
  readonly highlighted?: boolean
}

export interface Pipeline {
  readonly id: number
  readonly repoOwner: string
  readonly repoName: string
  readonly platform: string
  readonly active: boolean
  readonly softwareId: number | null
}

export interface PipelineRun {
  readonly number: number
  readonly status: string
  readonly branch: string | null
  readonly message: string | null
  readonly createdAt: string | null
  readonly url: string | null
  readonly commit: string | null
  readonly event: string | null
  readonly ref: string | null
}

export interface ScaffoldResult {
  readonly software: Software
  readonly repository: { readonly owner: string; readonly name: string; readonly htmlUrl: string | null; readonly cloneUrl: string | null; readonly sshUrl: string | null }
  readonly pipelineId: number | null
  readonly warnings: readonly string[]
}

export interface DeviceGrant {
  readonly deviceCode: string
  readonly userCode: string
  readonly verificationUrl: string
  readonly verificationUrlComplete: string
  readonly interval: number
  readonly expiresIn: number
  readonly scopes: readonly string[]
}

export interface Principal {
  readonly label: string | null
  readonly scopes: readonly string[]
}

export interface Category {
  readonly key: string
  readonly label: string
}

export interface Host {
  readonly name: string
  readonly url: string
}
