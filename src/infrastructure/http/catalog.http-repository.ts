/**
 * The {@link domain/repository/catalog.repository!CatalogRepository} port implemented on the WarpEngine admin API.
 *
 * @module
 */
import { AssetKinds } from '../../domain/model/asset-kind.model'
import type { SoftwareLink, Principal, Release, ScaffoldRequest, ScaffoldResult, Software } from '../../domain/model/catalog.model'
import type { CatalogRepository } from '../../domain/repository/catalog.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

const PAGE = { perPage: '200' }

/**
 * The catalog of a host over `/api/admin/v2`: softwares, releases, links, statistics
 * and the scaffold endpoint. Lists read one page of up to 200 items.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpCatalogRepository implements CatalogRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Reads who the token belongs to (`GET /api/admin/v2/me`).
   *
   * @returns The signed-in principal.
   */
  public async me(): Promise<Principal> {
    return this.client.admin<Principal>('GET', '/me')
  }

  /**
   * Reads the software statuses the host knows (`GET /api/admin/v2/software_statuses`).
   *
   * @returns The raw answer.
   */
  public async statuses(): Promise<unknown> {
    return this.client.admin<unknown>('GET', '/software_statuses')
  }

  /**
   * Lists softwares (`GET /api/admin/v2/softwares`).
   *
   * @param query - Extra filters for the query string, such as `name`.
   * @returns The first page of matching softwares.
   */
  public async softwares(query: Record<string, string> = {}): Promise<Software[]> {
    return this.client.adminList<Software>('/softwares', { ...PAGE, ...query })
  }

  /**
   * Finds the software with exactly this name, filtering the list by `name`.
   *
   * @param name - The software name.
   * @returns The software, or `null` when there is none.
   */
  public async softwareByName(name: string): Promise<Software | null> {
    return (await this.softwares({ name })).find((software: Software) => software.name === name) ?? null
  }

  /**
   * Changes fields of a software (`PATCH /api/admin/v2/softwares/:id`).
   *
   * @param id - The software id.
   * @param changes - The fields to change.
   * @returns The updated software.
   */
  public async updateSoftware(id: number, changes: Partial<Software>): Promise<Software> {
    return this.client.admin<Software>('PATCH', `/softwares/${String(id)}`, changes)
  }

  /**
   * Deletes a software from the host (`DELETE /api/admin/v2/softwares/:id`).
   *
   * @param id - The software id.
   */
  public async deleteSoftware(id: number): Promise<void> {
    await this.client.adminDelete(`/softwares/${String(id)}`)
  }

  /**
   * Deletes a release from the host (`DELETE /api/admin/v2/releases/:id`).
   *
   * @param id - The release id.
   */
  public async deleteRelease(id: number): Promise<void> {
    await this.client.adminDelete(`/releases/${String(id)}`)
  }

  /**
   * Lists the releases of a software, newest first (`GET /api/admin/v2/softwares/:id/releases`), with the asset
   * kinds of WECP api 6 (an older host's `cartridge` reads as `package`).
   *
   * @param softwareId - The software id.
   * @returns The releases.
   */
  public async releases(softwareId: number): Promise<Release[]> {
    return (await this.client.adminList<Release>(`/softwares/${String(softwareId)}/releases`, { ...PAGE, sort: '-createdAt' }))
      .map((release: Release) => AssetKinds.release(release))
  }

  /**
   * Lists the links of a software (`GET /api/admin/v2/softwares/:id/links`); the source repository is not among them.
   *
   * @param softwareId - The software id.
   * @returns The links.
   */
  public async links(softwareId: number): Promise<SoftwareLink[]> {
    return this.client.adminList<SoftwareLink>(`/softwares/${String(softwareId)}/links`, PAGE)
  }

  /**
   * Reads the download statistics of a software (`GET /api/admin/v2/softwares/:id/download_stats`).
   *
   * @param softwareId - The software id.
   * @returns The raw statistics.
   */
  public async downloadStats(softwareId: number): Promise<unknown> {
    return this.client.admin<unknown>('GET', `/softwares/${String(softwareId)}/download_stats`)
  }

  /**
   * Has the host create a software and its repository (`POST /api/admin/v2/softwares/scaffold`).
   *
   * @param request - The software to create.
   * @returns What the host created.
   */
  public async scaffold(request: ScaffoldRequest): Promise<ScaffoldResult> {
    return this.client.admin<ScaffoldResult>('POST', '/softwares/scaffold', request)
  }
}
