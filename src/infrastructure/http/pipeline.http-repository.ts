/**
 * The {@link domain/repository/pipeline.repository!PipelineRepository} port implemented on the WarpEngine admin API.
 *
 * @module
 */
import type { CiRepository, PipelineRun } from '../../domain/model/pipeline.model'
import type { PipelineRepository } from '../../domain/repository/pipeline.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * The CI repositories the host knows and their pipeline runs, over `/api/admin/v2`.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpPipelineRepository implements PipelineRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Lists the CI repositories, up to 200 (`GET /api/admin/v2/ci_repositories`).
   *
   * @returns The CI repositories.
   */
  public async repositories(): Promise<CiRepository[]> {
    return this.client.adminList<CiRepository>('/ci_repositories', { perPage: '200' })
  }

  /**
   * Lists the recent pipeline runs of a CI repository (`GET /api/admin/v2/ci_repositories/:id/runs`).
   *
   * @param repositoryId - The CI repository id.
   * @returns The runs.
   */
  public async runs(repositoryId: number): Promise<PipelineRun[]> {
    return this.client.admin<PipelineRun[]>('GET', `/ci_repositories/${String(repositoryId)}/runs`)
  }

  /**
   * Starts a pipeline run of a CI repository on a branch (`POST /api/admin/v2/ci_repositories/:id/trigger`).
   *
   * @param repositoryId - The CI repository id.
   * @param branch - The branch to build.
   * @returns The started run.
   */
  public async trigger(repositoryId: number, branch: string): Promise<PipelineRun> {
    return this.client.admin<PipelineRun>('POST', `/ci_repositories/${String(repositoryId)}/trigger`, { branch })
  }
}
