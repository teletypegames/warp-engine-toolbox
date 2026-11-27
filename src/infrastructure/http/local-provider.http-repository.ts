/**
 * The {@link domain/repository/local-provider.repository!LocalProviderRepository} port implemented on the WarpEngine admin API.
 *
 * @module
 */
import type { LocalProvider, LocalTask } from '../../domain/model/local-ci.model'
import type { LocalProviderRepository } from '../../domain/repository/local-provider.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * The local providers of a WarpEngine Local (its Gitea and Woodpecker) and their
 * tasks, over `/api/admin/v2`.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpLocalProviderRepository implements LocalProviderRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the local engine, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Lists the local providers and their state (`GET /api/admin/v2/local_providers`).
   *
   * @returns The providers.
   */
  public async providers(): Promise<LocalProvider[]> {
    return this.client.admin<LocalProvider[]>('GET', '/local_providers')
  }

  /**
   * Reads the progress of a task (`GET /api/admin/v2/local_tasks/:id`).
   *
   * @param id - The task id.
   * @returns The task.
   */
  public async task(id: number): Promise<LocalTask> {
    return this.client.admin<LocalTask>('GET', `/local_tasks/${String(id)}`)
  }

  /**
   * Starts setting up the local CI for a software (`POST /api/admin/v2/softwares/:id/local_ci`).
   *
   * @param softwareId - The software id.
   * @returns The started task, to poll with {@link HttpLocalProviderRepository.task}.
   */
  public async setUpCi(softwareId: number): Promise<LocalTask> {
    return this.client.admin<LocalTask>('POST', `/softwares/${String(softwareId)}/local_ci`)
  }
}
