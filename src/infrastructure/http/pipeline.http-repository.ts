/**
 * The {@link domain/repository/pipeline.repository!PipelineRepository} port implemented on the WarpEngine admin API.
 *
 * @module
 */
import type { Pipeline, PipelineRun } from '../../domain/model/pipeline.model'
import type { PipelineRepository } from '../../domain/repository/pipeline.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * The CI pipelines the host knows and their runs, over `/api/admin/v1`.
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
   * Lists the pipelines, up to 200 (`GET /api/admin/v1/pipelines`).
   *
   * @returns The pipelines.
   */
  public async pipelines(): Promise<Pipeline[]> {
    return this.client.adminList<Pipeline>('/pipelines', { perPage: '200' })
  }

  /**
   * Lists the recent runs of a pipeline (`GET /api/admin/v1/pipelines/:id/runs`).
   *
   * @param pipelineId - The pipeline id.
   * @returns The runs.
   */
  public async runs(pipelineId: number): Promise<PipelineRun[]> {
    return this.client.admin<PipelineRun[]>('GET', `/pipelines/${String(pipelineId)}/runs`)
  }

  /**
   * Starts a pipeline run on a branch (`POST /api/admin/v1/pipelines/:id/trigger`).
   *
   * @param pipelineId - The pipeline id.
   * @param branch - The branch to build.
   * @returns The started run.
   */
  public async trigger(pipelineId: number, branch: string): Promise<PipelineRun> {
    return this.client.admin<PipelineRun>('POST', `/pipelines/${String(pipelineId)}/trigger`, { branch })
  }
}
