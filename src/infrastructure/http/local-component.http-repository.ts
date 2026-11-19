/**
 * The {@link domain/repository/local-component.repository!LocalComponentRepository} port implemented on the WarpEngine admin API.
 *
 * @module
 */
import type { LocalComponent, LocalOperation } from '../../domain/model/local-ci.model'
import type { LocalComponentRepository } from '../../domain/repository/local-component.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * The local components of a WarpEngine Local (its Gitea and Woodpecker) and their
 * operations, over `/api/admin/v1`.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpLocalComponentRepository implements LocalComponentRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the local engine, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Lists the local components and their state (`GET /api/admin/v1/local_components`).
   *
   * @returns The components.
   */
  public async components(): Promise<LocalComponent[]> {
    return this.client.admin<LocalComponent[]>('GET', '/local_components')
  }

  /**
   * Reads the progress of an operation (`GET /api/admin/v1/local_operations/:id`).
   *
   * @param id - The operation id.
   * @returns The operation.
   */
  public async operation(id: number): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('GET', `/local_operations/${String(id)}`)
  }

  /**
   * Starts setting up the local CI for a software (`POST /api/admin/v1/softwares/:id/local_ci`).
   *
   * @param softwareId - The software id.
   * @returns The started operation, to poll with {@link HttpLocalComponentRepository.operation}.
   */
  public async setUpCi(softwareId: number): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('POST', `/softwares/${String(softwareId)}/local_ci`)
  }
}
