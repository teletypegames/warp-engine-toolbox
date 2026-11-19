/**
 * Port to the CI pipelines of the host.
 *
 * @module
 */
import type { Pipeline, PipelineRun } from '../model/pipeline.model'

/**
 * Port to the CI pipelines the host knows, through its admin API.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface PipelineRepository {
  /**
   * Lists the pipelines.
   *
   * @returns The pipelines, at most one page of 200.
   */
  pipelines(): Promise<Pipeline[]>
  /**
   * Lists the runs of a pipeline.
   *
   * @param pipelineId - The pipeline id.
   * @returns The runs as the host orders them.
   */
  runs(pipelineId: number): Promise<PipelineRun[]>
  /**
   * Starts a new run of a pipeline.
   *
   * @param pipelineId - The pipeline id.
   * @param branch - The branch to build.
   * @returns The started run.
   */
  trigger(pipelineId: number, branch: string): Promise<PipelineRun>
}
