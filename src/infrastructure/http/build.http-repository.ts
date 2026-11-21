/**
 * The {@link domain/repository/build.repository!BuildRepository} port implemented on the WarpEngine build API.
 *
 * @module
 */
import type { Category } from '../../domain/model/catalog.model'
import { DomainError, msg } from '../../domain/model/message.model'
import type { PlatformDescription } from '../../domain/model/platform-description.model'
import type { PublishCheck } from '../../domain/model/publish-check.model'
import type { BuildRepository, PlayPreviewRequest, PublishCheckRequest } from '../../domain/repository/build.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'
import { Loopback } from './loopback'

const PAGE_TIMEOUT_MS = 30_000

/**
 * The build side of a host over HTTP: platforms, vocabulary, metadata schemas, the
 * pipeline preview, the publish check and the play URLs.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpBuildRepository implements BuildRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Lists the platforms the host builds (`GET /build/platforms`).
   *
   * @returns The platform descriptions.
   */
  public async platforms(): Promise<PlatformDescription[]> {
    return (await this.client.json<{ platforms: PlatformDescription[] }>('GET', '/build/platforms')).platforms
  }

  /**
   * Lists the software categories of the host's vocabulary (`GET /api/software/vocabulary`).
   *
   * @returns The categories; an empty list when the host has none.
   */
  public async categories(): Promise<Category[]> {
    return (await this.client.json<{ categories?: Category[] }>('GET', '/api/software/vocabulary')).categories ?? []
  }

  /**
   * Fetches the JSON schema of a platform's `metadata.json` (`GET /build/platforms/:platform/metadata-schema`).
   *
   * @param platform - The platform name.
   * @returns The schema as parsed JSON.
   */
  public async metadataSchema(platform: string): Promise<unknown> {
    return this.client.json('GET', `/build/platforms/${encodeURIComponent(platform)}/metadata-schema`)
  }

  /**
   * Fetches the CI pipeline the host serves for a platform (`GET /build/config?platform=…&name=…`).
   *
   * @param platform - The platform name.
   * @param name - The software name, or `null` to leave it out.
   * @returns The pipeline YAML.
   */
  public async pipelinePreview(platform: string, name: string | null): Promise<string> {
    const query: URLSearchParams = new URLSearchParams({ platform })
    if (name) query.set('name', name)
    return this.client.text('GET', `/build/config?${query.toString()}`)
  }

  /**
   * Asks the host whether it would accept a release (`POST /build/check`).
   *
   * @param request - The platform, the metadata and the version, if any.
   * @returns The host's verdict.
   */
  public async check(request: PublishCheckRequest): Promise<PublishCheck> {
    const body: Record<string, unknown> = { platform: request.platform, metadata: request.metadata }
    if (request.version) body['version'] = request.version
    return this.client.json('POST', '/build/check', body)
  }

  /**
   * Builds the URL of the host's play preview page for a platform (`/play-preview/:platform[/:binding]`); sends nothing.
   *
   * @param request - The platform, binding, title, parameters and start file of the preview.
   * @returns The absolute URL, with `payload=message` and the given options in the query.
   */
  public playPreviewUrl(request: PlayPreviewRequest): string {
    const query: URLSearchParams = new URLSearchParams({ payload: 'message' })
    if (request.title) query.set('title', request.title)
    if (request.params !== undefined && request.params !== null) query.set('params', JSON.stringify(request.params))
    if (request.start) query.set('start', request.start)
    const binding: string = request.binding ? `/${encodeURIComponent(request.binding)}` : ''
    return `${this.client.baseUrl}/play-preview/${encodeURIComponent(request.platform)}${binding}?${query.toString()}`
  }

  /**
   * Downloads a page, such as the play preview, with a plain `fetch` and a 30-second timeout.
   *
   * @param url - The absolute URL.
   * @returns The page's HTML.
   * @throws {@link domain/model/message.model!DomainError} when the answer is not 2xx.
   */
  public async page(url: string): Promise<string> {
    const response: Response = await fetch(Loopback.reach(url), { signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) })
    if (!response.ok) throw new DomainError(msg('{0} answered {1} for the play preview', this.client.baseUrl, response.status))
    return response.text()
  }

  /**
   * Builds the URL of a released version's play page (`/play/:name/:version`); sends nothing.
   *
   * @param name - The software name.
   * @param version - The release version.
   * @returns The absolute URL.
   */
  public playUrl(name: string, version: string): string {
    return `${this.client.baseUrl}/play/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  }
}
