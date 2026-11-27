/**
 * Port to the local providers (Git server, CI) of a local WarpEngine.
 *
 * @module
 */
import type { LocalProvider, LocalTask } from '../model/local-ci.model'

/**
 * Port to the providers a local WarpEngine runs beside itself, through its admin API.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface LocalProviderRepository {
  /**
   * Lists the local providers and their state.
   *
   * @returns The providers.
   */
  providers(): Promise<LocalProvider[]>
  /**
   * Reads the progress of a long-running task.
   *
   * @param id - The task id.
   * @returns The task with its state and steps.
   */
  task(id: number): Promise<LocalTask>
  /**
   * Starts setting up the local Git repository and CI for a software; the engine works on in the background.
   *
   * @param softwareId - The software id.
   * @returns The started task, to follow with {@link LocalProviderRepository.task}.
   */
  setUpCi(softwareId: number): Promise<LocalTask>
}
