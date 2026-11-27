/**
 * The HTTP client every WarpEngine repository talks through.
 *
 * @module
 */
import { WarpEngineError } from './warp-engine.error'
import { Loopback } from './loopback'

const TIMEOUT_MS = 30_000
const ADMIN = '/api/admin/v2'

/**
 * A `fetch` wrapper for one WarpEngine host: JSON in and out, an optional bearer
 * token, a 30-second timeout, and the `{ data: … }` envelope of the admin API
 * (`/api/admin/v2`) unwrapped.
 *
 * Every request throws a {@link infrastructure/http/warp-engine.error!WarpEngineError} when the host cannot be reached
 * (status `0`) or answers with a non-2xx status.
 */
export class WarpEngineHttpClient {
  /** The host URL without a trailing slash, such as `https://games.example.org`. */
  public readonly baseUrl: string

  /**
   * Creates a client for a host.
   *
   * @param baseUrl - The host URL; trailing slashes are removed.
   * @param token - The API token sent as `Authorization: Bearer …`, or `null` for anonymous requests.
   */
  public constructor(baseUrl: string, private readonly token: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  /**
   * Makes a client for the same host with another token.
   *
   * @param token - The token to send, or `null` for none.
   * @returns A new client; this one is unchanged.
   */
  public withToken(token: string | null): WarpEngineHttpClient {
    return new WarpEngineHttpClient(this.baseUrl, token)
  }

  /**
   * Sends a request and parses the JSON answer.
   *
   * @param method - The HTTP method.
   * @param path - The path on the host, with its query string.
   * @param body - Sent as JSON, or as multipart when it is a `FormData`; omitted when `undefined`.
   * @returns The parsed body, or `{}` when the answer is empty.
   * @throws {@link infrastructure/http/warp-engine.error!WarpEngineError} when the request fails.
   */
  public async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const text: string = await (await this.request(method, path, body)).text()
    return (text ? JSON.parse(text) : {}) as T
  }

  /**
   * Sends a request without a body and returns the answer as text.
   *
   * @param method - The HTTP method.
   * @param path - The path on the host, with its query string.
   * @returns The response body.
   * @throws {@link infrastructure/http/warp-engine.error!WarpEngineError} when the request fails.
   */
  public async text(method: string, path: string): Promise<string> {
    return (await this.request(method, path)).text()
  }

  /**
   * Calls the admin API and unwraps its `data` envelope.
   *
   * @param method - The HTTP method.
   * @param path - The path below `/api/admin/v2`, such as `/me`.
   * @param body - Sent as JSON; omitted when `undefined`.
   * @returns The `data` field of the answer.
   * @throws {@link infrastructure/http/warp-engine.error!WarpEngineError} when the request fails.
   */
  public async admin<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await this.json<{ data: T }>(method, `${ADMIN}${path}`, body)).data
  }

  /**
   * Sends a `DELETE` to the admin API and ignores the answer body.
   *
   * @param path - The path below `/api/admin/v2`.
   * @throws {@link infrastructure/http/warp-engine.error!WarpEngineError} when the request fails.
   */
  public async adminDelete(path: string): Promise<void> {
    await this.request('DELETE', `${ADMIN}${path}`)
  }

  /**
   * Posts a multipart form to the admin API and unwraps its `data` envelope.
   *
   * @param path - The path below `/api/admin/v2`.
   * @param form - The form, files included.
   * @returns The `data` field of the answer.
   * @throws {@link infrastructure/http/warp-engine.error!WarpEngineError} when the request fails.
   */
  public async adminForm<T>(path: string, form: FormData): Promise<T> {
    const response: Response = await this.request('POST', `${ADMIN}${path}`, form)
    return (JSON.parse(await response.text()) as { data: T }).data
  }

  /**
   * Reads one page of an admin API list (`GET` with a query string).
   *
   * @param path - The collection path below `/api/admin/v2`, such as `/softwares`.
   * @param query - The query parameters, such as `perPage`, `sort` and filters.
   * @returns The items of the `data` field.
   * @throws {@link infrastructure/http/warp-engine.error!WarpEngineError} when the request fails.
   */
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
      return await fetch(Loopback.reach(url), init)
    } catch (error: unknown) {
      throw new WarpEngineError(`${this.baseUrl} cannot be reached: ${error instanceof Error ? error.message : String(error)}`, 0)
    }
  }

  private init(method: string, body: unknown): RequestInit {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) }
    if (body === undefined) return init
    if (body instanceof FormData) return { ...init, body }
    headers['Content-Type'] = 'application/json'
    return { ...init, body: JSON.stringify(body) }
  }
}
