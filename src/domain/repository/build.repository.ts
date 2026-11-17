import type { Category } from '../model/catalog.model'
import type { PlatformDescription } from '../model/platform-description.model'
import type { PublishCheck } from '../model/publish-check.model'
import type { MetadataValues } from '../model/metadata.model'

export interface PublishCheckRequest {
  readonly platform: string
  readonly metadata: MetadataValues
  readonly version: string | null
}

export interface PlayPreviewRequest {
  readonly platform: string
  readonly title: string
  readonly params: unknown
  readonly start: string | null
  readonly binding: string | null
}

export interface BuildRepository {
  platforms(): Promise<PlatformDescription[]>
  categories(): Promise<Category[]>
  metadataSchema(platform: string): Promise<unknown>
  pipelinePreview(platform: string, name: string | null): Promise<string>
  check(request: PublishCheckRequest): Promise<PublishCheck>
  playPreviewUrl(request: PlayPreviewRequest): string
  page(url: string): Promise<string>
  playUrl(name: string, version: string): string
}
