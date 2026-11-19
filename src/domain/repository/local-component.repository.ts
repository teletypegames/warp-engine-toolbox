/**
 * Port to the local components (Git server, CI) of a local WarpEngine.
 *
 * @module
 */
import type { LocalComponent, LocalOperation } from '../model/local-ci.model'

/**
 * Port to the components a local WarpEngine runs beside itself, through its admin API.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface LocalComponentRepository {
  /**
   * Lists the local components and their state.
   *
   * @returns The components.
   */
  components(): Promise<LocalComponent[]>
  /**
   * Reads the progress of a long-running operation.
   *
   * @param id - The operation id.
   * @returns The operation with its state and steps.
   */
  operation(id: number): Promise<LocalOperation>
  /**
   * Starts setting up the local Git repository and CI for a software; the engine works on in the background.
   *
   * @param softwareId - The software id.
   * @returns The started operation, to follow with {@link LocalComponentRepository.operation}.
   */
  setUpCi(softwareId: number): Promise<LocalOperation>
}
