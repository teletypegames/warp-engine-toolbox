/**
 * Port to the CI repositories of the host and their pipeline runs.
 *
 * @module
 */
import type { CiRepository, PipelineRun } from '../model/pipeline.model'

/**
 * Port to the CI repositories the host knows and their pipeline runs, through its admin API.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface PipelineRepository {
  /**
   * Lists the CI repositories.
   *
   * @returns The CI repositories, at most one page of 200.
   */
  repositories(): Promise<CiRepository[]>
  /**
   * Lists the pipeline runs of a CI repository.
   *
   * @param repositoryId - The CI repository id.
   * @returns The runs as the host orders them.
   */
  runs(repositoryId: number): Promise<PipelineRun[]>
  /**
   * Starts a new pipeline run of a CI repository.
   *
   * @param repositoryId - The CI repository id.
   * @param branch - The branch to build.
   * @returns The started run.
   */
  trigger(repositoryId: number, branch: string): Promise<PipelineRun>
}
