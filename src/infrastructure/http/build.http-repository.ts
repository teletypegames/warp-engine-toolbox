import type { Category } from '../../domain/model/catalog.model'
import { DomainError, msg } from '../../domain/model/message.model'
import type { PlatformDescription } from '../../domain/model/platform-description.model'
import type { PublishCheck } from '../../domain/model/publish-check.model'
import type { BuildRepository, PlayPreviewRequest, PublishCheckRequest } from '../../domain/repository/build.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

const PAGE_TIMEOUT_MS = 30_000

export class HttpBuildRepository implements BuildRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async platforms(): Promise<PlatformDescription[]> {
    return (await this.client.json<{ platforms: PlatformDescription[] }>('GET', '/build/platforms')).platforms
  }

  public async categories(): Promise<Category[]> {
    return (await this.client.json<{ categories?: Category[] }>('GET', '/api/software/vocabulary')).categories ?? []
  }

  public async metadataSchema(platform: string): Promise<unknown> {
    return this.client.json('GET', `/build/platforms/${encodeURIComponent(platform)}/metadata-schema`)
  }

  public async pipelinePreview(platform: string, name: string | null): Promise<string> {
    const query: URLSearchParams = new URLSearchParams({ platform })
    if (name) query.set('name', name)
    return this.client.text('GET', `/build/config?${query.toString()}`)
  }

  public async check(request: PublishCheckRequest): Promise<PublishCheck> {
    const body: Record<string, unknown> = { platform: request.platform, metadata: request.metadata }
    if (request.version) body['version'] = request.version
    return this.client.json('POST', '/build/check', body)
  }

  public playPreviewUrl(request: PlayPreviewRequest): string {
    const query: URLSearchParams = new URLSearchParams({ payload: 'message' })
    if (request.title) query.set('title', request.title)
    if (request.params !== undefined && request.params !== null) query.set('params', JSON.stringify(request.params))
    if (request.start) query.set('start', request.start)
    const binding: string = request.binding ? `/${encodeURIComponent(request.binding)}` : ''
    return `${this.client.baseUrl}/play-preview/${encodeURIComponent(request.platform)}${binding}?${query.toString()}`
  }

  public async page(url: string): Promise<string> {
    const response: Response = await fetch(url, { signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) })
    if (!response.ok) throw new DomainError(msg('{0} answered {1} for the play preview', this.client.baseUrl, response.status))
    return response.text()
  }

  public playUrl(name: string, version: string): string {
    return `${this.client.baseUrl}/play/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  }
}
