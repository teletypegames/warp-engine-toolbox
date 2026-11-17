import type {
  Category, DeviceGrant, ExternalLink, Pipeline, PipelineRun, PlatformDescription, Principal, PublishCheck, Release,
  ScaffoldResult, Software
} from '../domain/types'

export class WarpEngineError extends Error {
  public readonly status: number

  public constructor(message: string, status: number) {
    super(message)
    this.name = 'WarpEngineError'
    this.status = status
  }
}

export type TokenState = 'pending' | 'approved' | 'denied' | 'expired'

export interface TokenPoll {
  readonly state: TokenState
  readonly token: string | null
}

export interface Paged<T> {
  readonly data: T[]
  readonly meta: { readonly total?: number } | null
}

export const TOOL_SCOPES: readonly string[] = ['admin:read', 'admin:write']

export class WarpEngineClient {
  private readonly baseUrl: string
  private readonly token: string | null

  public constructor(baseUrl: string, token: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.token = token
  }

  public get url(): string {
    return this.baseUrl
  }

  public withToken(token: string | null): WarpEngineClient {
    return new WarpEngineClient(this.baseUrl, token)
  }

  public async platforms(): Promise<PlatformDescription[]> {
    const body: { platforms: PlatformDescription[] } = await this.json('GET', '/build/platforms')
    return body.platforms
  }

  public async metadataSchema(platform: string): Promise<unknown> {
    return this.json('GET', `/build/platforms/${encodeURIComponent(platform)}/metadata-schema`)
  }

  public async pipelinePreview(platform: string, name: string | null): Promise<string> {
    const query: URLSearchParams = new URLSearchParams({ platform })
    if (name) query.set('name', name)
    return this.text('GET', `/build/config?${query.toString()}`)
  }

  public async check(input: { platform: string; metadata: Record<string, unknown>; version: string | null; kinds: string[] | null }): Promise<PublishCheck> {
    const body: Record<string, unknown> = { platform: input.platform, metadata: input.metadata }
    if (input.version) body['version'] = input.version
    if (input.kinds) body['kinds'] = input.kinds
    return this.json('POST', '/build/check', body)
  }

  public playPreviewUrl(platform: string, payload: string, options: { title?: string; params?: unknown; start?: string | null; binding?: string | null }): string {
    const query: URLSearchParams = new URLSearchParams({ payload })
    if (options.title) query.set('title', options.title)
    if (options.params !== undefined && options.params !== null) query.set('params', JSON.stringify(options.params))
    if (options.start) query.set('start', options.start)
    const binding: string = options.binding ? `/${encodeURIComponent(options.binding)}` : ''
    return `${this.baseUrl}/play-preview/${encodeURIComponent(platform)}${binding}?${query.toString()}`
  }

  public playUrl(name: string, version: string): string {
    return `${this.baseUrl}/play/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  }

  public async startDeviceGrant(clientName: string, scopes: readonly string[] = TOOL_SCOPES): Promise<DeviceGrant> {
    return this.json('POST', '/api/auth/device', { client_name: clientName, scopes })
  }

  public async pollDeviceGrant(deviceCode: string): Promise<TokenPoll> {
    const body: { state: TokenState; token?: string } = await this.json('POST', '/api/auth/device/token', { device_code: deviceCode })
    return { state: body.state, token: body.token ?? null }
  }

  public async me(): Promise<Principal> {
    return this.admin<Principal>('GET', '/me')
  }

  public async categories(): Promise<Category[]> {
    const body: { categories?: Category[] } = await this.json('GET', '/api/software/vocabulary')
    return body.categories ?? []
  }

  public async softwares(query: Record<string, string> = {}): Promise<Software[]> {
    return this.adminList<Software>('/softwares', { perPage: '200', ...query })
  }

  public async softwareByName(name: string): Promise<Software | null> {
    const found: Software[] = await this.softwares({ name })
    return found.find((software: Software) => software.name === name) ?? null
  }

  public async updateSoftware(id: number, changes: Partial<Software>): Promise<Software> {
    return this.admin<Software>('PATCH', `/softwares/${String(id)}`, changes)
  }

  public async releases(softwareId: number, commitSha: string | null = null): Promise<Release[]> {
    const query: Record<string, string> = { perPage: '200', sort: '-createdAt' }
    if (commitSha) query['commitSha'] = commitSha
    return this.adminList<Release>(`/softwares/${String(softwareId)}/releases`, query)
  }

  public async externalLinks(softwareId: number): Promise<ExternalLink[]> {
    return this.adminList<ExternalLink>(`/softwares/${String(softwareId)}/external_links`, { perPage: '200' })
  }

  public async pipelines(): Promise<Pipeline[]> {
    return this.adminList<Pipeline>('/pipelines', { perPage: '200' })
  }

  public async runs(pipelineId: number): Promise<PipelineRun[]> {
    return this.admin<PipelineRun[]>('GET', `/pipelines/${String(pipelineId)}/runs`)
  }

  public async trigger(pipelineId: number, branch: string): Promise<PipelineRun> {
    return this.admin<PipelineRun>('POST', `/pipelines/${String(pipelineId)}/trigger`, { branch })
  }

  public async downloadStats(softwareId: number): Promise<unknown> {
    return this.admin<unknown>('GET', `/softwares/${String(softwareId)}/download_stats`)
  }

  public async scaffold(input: { name: string; title: string; platform: string; category: string | null; description: string }): Promise<ScaffoldResult> {
    return this.admin<ScaffoldResult>('POST', '/softwares/scaffold', input)
  }

  public async adminRaw(method: string, path: string, body?: unknown): Promise<unknown> {
    return this.admin<unknown>(method, path, body)
  }

  private async admin<T>(method: string, path: string, body?: unknown): Promise<T> {
    const answer: { data: T } = await this.json(method, `/api/admin/v1${path}`, body)
    return answer.data
  }

  private async adminList<T>(path: string, query: Record<string, string>): Promise<T[]> {
    const search: string = new URLSearchParams(query).toString()
    const answer: { data: T[] } = await this.json('GET', `/api/admin/v1${path}${search ? `?${search}` : ''}`)
    return answer.data
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response: Response = await this.request(method, path, body)
    const text: string = await response.text()
    return (text ? JSON.parse(text) : {}) as T
  }

  private async text(method: string, path: string): Promise<string> {
    const response: Response = await this.request(method, path)
    return response.text()
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(30_000) }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, init)
    } catch (error: unknown) {
      throw new WarpEngineError(`${this.baseUrl} cannot be reached: ${error instanceof Error ? error.message : String(error)}`, 0)
    }
    if (!response.ok) throw new WarpEngineError(await errorMessage(response), response.status)
    return response
  }
}

async function errorMessage(response: Response): Promise<string> {
  const text: string = await response.text().catch(() => '')
  try {
    const parsed: { error?: unknown } = JSON.parse(text) as { error?: unknown }
    const error: unknown = parsed.error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  } catch {
    /* not JSON */
  }
  return `${String(response.status)} ${response.statusText}`.trim()
}
