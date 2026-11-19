export interface ReleaseAsset {
  readonly id: number
  readonly kind: string
  readonly path: string
}

export type ReleaseChannel = 'stable' | 'beta' | 'dev'

export interface Release {
  readonly id: number
  readonly softwareId: number
  readonly version: string
  readonly channel?: ReleaseChannel
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

export type SoftwareField = 'status' | 'category' | 'highlighted' | 'title'

export interface Category {
  readonly key: string
  readonly label: string
}

export interface Principal {
  readonly label: string | null
  readonly scopes: readonly string[]
}

export interface ScaffoldRepository {
  readonly owner: string
  readonly name: string
  readonly htmlUrl: string | null
  readonly cloneUrl: string | null
  readonly sshUrl: string | null
}

export interface ScaffoldResult {
  readonly software: Software
  readonly repository: ScaffoldRepository
  readonly pipelineId: number | null
  readonly warnings: readonly string[]
}

export interface ScaffoldRequest {
  readonly name: string
  readonly title: string
  readonly platform: string
  readonly category: string | null
  readonly description: string
}

export const DEFAULT_STATUSES: readonly string[] = ['released', 'demo', 'development', 'archived']

export class Releases {
  public static isDev(release: Release): boolean {
    return release.version.startsWith('dev-')
  }

  public static listed(releases: readonly Release[]): Release[] {
    return releases.filter((release: Release) => !Releases.isDev(release))
  }
}
