import type { ExternalLink, Principal, Release, ScaffoldRequest, ScaffoldResult, Software } from '../../domain/model/catalog.model'
import type { CatalogRepository } from '../../domain/repository/catalog.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

const PAGE = { perPage: '200' }

export class HttpCatalogRepository implements CatalogRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async me(): Promise<Principal> {
    return this.client.admin<Principal>('GET', '/me')
  }

  public async statuses(): Promise<unknown> {
    return this.client.admin<unknown>('GET', '/software_statuses')
  }

  public async softwares(query: Record<string, string> = {}): Promise<Software[]> {
    return this.client.adminList<Software>('/softwares', { ...PAGE, ...query })
  }

  public async softwareByName(name: string): Promise<Software | null> {
    return (await this.softwares({ name })).find((software: Software) => software.name === name) ?? null
  }

  public async updateSoftware(id: number, changes: Partial<Software>): Promise<Software> {
    return this.client.admin<Software>('PATCH', `/softwares/${String(id)}`, changes)
  }

  public async releases(softwareId: number): Promise<Release[]> {
    return this.client.adminList<Release>(`/softwares/${String(softwareId)}/releases`, { ...PAGE, sort: '-createdAt' })
  }

  public async externalLinks(softwareId: number): Promise<ExternalLink[]> {
    return this.client.adminList<ExternalLink>(`/softwares/${String(softwareId)}/external_links`, PAGE)
  }

  public async downloadStats(softwareId: number): Promise<unknown> {
    return this.client.admin<unknown>('GET', `/softwares/${String(softwareId)}/download_stats`)
  }

  public async scaffold(request: ScaffoldRequest): Promise<ScaffoldResult> {
    return this.client.admin<ScaffoldResult>('POST', '/softwares/scaffold', request)
  }
}
