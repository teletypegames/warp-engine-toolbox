import { WarpEngineError } from './warp-engine.error'

const TIMEOUT_MS = 30_000
const ADMIN = '/api/admin/v1'

export class WarpEngineHttpClient {
  public readonly baseUrl: string

  public constructor(baseUrl: string, private readonly token: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  public withToken(token: string | null): WarpEngineHttpClient {
    return new WarpEngineHttpClient(this.baseUrl, token)
  }

  public async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const text: string = await (await this.request(method, path, body)).text()
    return (text ? JSON.parse(text) : {}) as T
  }

  public async text(method: string, path: string): Promise<string> {
    return (await this.request(method, path)).text()
  }

  public async admin<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await this.json<{ data: T }>(method, `${ADMIN}${path}`, body)).data
  }

  public async adminList<T>(path: string, query: Record<string, string>): Promise<T[]> {
    const search: string = new URLSearchParams(query).toString()
    return (await this.json<{ data: T[] }>('GET', `${ADMIN}${path}${search ? `?${search}` : ''}`)).data
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const response: Response = await this.send(`${this.baseUrl}${path}`, this.init(method, body))
    if (!response.ok) throw await WarpEngineError.from(response)
    return response
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init)
    } catch (error: unknown) {
      throw new WarpEngineError(`${this.baseUrl} cannot be reached: ${error instanceof Error ? error.message : String(error)}`, 0)
    }
  }

  private init(method: string, body: unknown): RequestInit {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) }
    if (body === undefined) return init
    headers['Content-Type'] = 'application/json'
    return { ...init, body: JSON.stringify(body) }
  }
}
