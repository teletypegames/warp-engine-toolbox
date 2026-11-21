/**
 * The {@link domain/repository/public-catalog.repository!PublicCatalogRepository} port implemented on the public catalog (WECP) of a host.
 *
 * @module
 */
import type { ForkOrigin, PublicSoftware, SoftwareFork, SoftwareSource } from '../../domain/model/fork.model'
import type { PublicCatalogRepository } from '../../domain/repository/public-catalog.repository'
import { WarpEngineError } from './warp-engine.error'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

type Json = Readonly<Record<string, unknown>>

const NOT_FOUND = 404
const LOOKUP_PAGE = { page: '1', per_page: '100' }

/**
 * The catalog over `GET /api/software` (one entry is `{ software, latestRelease, … }`) and the forks over
 * `GET /api/softwares/:name/forks`. Every field is read defensively: what the host does not send is empty.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpPublicCatalogRepository implements PublicCatalogRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, with or without a token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Reads the whole catalog (`GET /api/software`, without paging).
   *
   * @returns The softwares.
   */
  public async softwares(): Promise<PublicSoftware[]> {
    return HttpPublicCatalogRepository.entries(await this.client.json<unknown>('GET', '/api/software'))
  }

  /**
   * Searches the catalog for the name (`GET /api/software?q=name`) and keeps the exact match.
   *
   * @param name - The software name.
   * @returns The software, or `null` when there is none.
   */
  public async software(name: string): Promise<PublicSoftware | null> {
    const query: string = new URLSearchParams({ ...LOOKUP_PAGE, q: name }).toString()
    const found: PublicSoftware[] = HttpPublicCatalogRepository.entries(await this.client.json<unknown>('GET', `/api/software?${query}`))
    return found.find((software: PublicSoftware) => software.name === name) ?? null
  }

  /**
   * Lists the forks of a software (`GET /api/softwares/:name/forks`); a `404` (an older host, or a software not visible) gives none.
   *
   * @param name - The software name.
   * @returns The forks.
   */
  public async forks(name: string): Promise<SoftwareFork[]> {
    try {
      const answer: unknown = await this.client.json<unknown>('GET', `/api/softwares/${encodeURIComponent(name)}/forks`)
      return HttpPublicCatalogRepository.list(HttpPublicCatalogRepository.object(answer)['forks']).map((fork: Json) => HttpPublicCatalogRepository.fork(fork))
    } catch (error: unknown) {
      if (error instanceof WarpEngineError && error.status === NOT_FOUND) return []
      throw error
    }
  }

  private static entries(answer: unknown): PublicSoftware[] {
    return HttpPublicCatalogRepository.list(HttpPublicCatalogRepository.object(answer)['softwares'])
      .map((entry: Json) => HttpPublicCatalogRepository.software(entry))
      .filter((software: PublicSoftware) => software.name !== '')
  }

  private static software(entry: Json): PublicSoftware {
    const software: Json = HttpPublicCatalogRepository.object(entry['software'] ?? entry)
    const count: unknown = software['forksCount']
    return {
      name: HttpPublicCatalogRepository.text(software['name']) ?? '', title: HttpPublicCatalogRepository.text(software['title']) ?? '',
      author: HttpPublicCatalogRepository.text(software['author']), license: HttpPublicCatalogRepository.text(software['license']),
      latestVersion: HttpPublicCatalogRepository.text(HttpPublicCatalogRepository.object(entry['latestRelease'])['version']),
      source: HttpPublicCatalogRepository.source(software['source']), forksAllowed: software['forksAllowed'] === true,
      forkOf: HttpPublicCatalogRepository.origin(software['forkOf']), forksCount: typeof count === 'number' ? count : null
    }
  }

  private static source(value: unknown): SoftwareSource | null {
    const source: Json = HttpPublicCatalogRepository.object(value)
    const url: string | null = HttpPublicCatalogRepository.text(source['url'])
    if (!url) return null
    const visibility: unknown = source['public']
    return { url, sshUrl: HttpPublicCatalogRepository.text(source['sshUrl']), ref: HttpPublicCatalogRepository.text(source['ref']), public: typeof visibility === 'boolean' ? visibility : null }
  }

  private static origin(value: unknown): ForkOrigin | null {
    const origin: Json = HttpPublicCatalogRepository.object(value)
    const engine: string | null = HttpPublicCatalogRepository.text(origin['engine'])
    const name: string | null = HttpPublicCatalogRepository.text(origin['name'])
    if (!engine || !name) return null
    return { engine, name, version: HttpPublicCatalogRepository.text(origin['version']), repo: HttpPublicCatalogRepository.text(origin['repo']) }
  }

  private static fork(fork: Json): SoftwareFork {
    const name: string = HttpPublicCatalogRepository.text(fork['name']) ?? ''
    return { engine: HttpPublicCatalogRepository.text(fork['engine']) ?? '', name, title: HttpPublicCatalogRepository.text(fork['title']) ?? name, local: fork['local'] === true }
  }

  private static object(value: unknown): Json {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}
  }

  private static list(value: unknown): Json[] {
    return Array.isArray(value) ? value.map((item: unknown) => HttpPublicCatalogRepository.object(item)) : []
  }

  private static text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
  }
}
