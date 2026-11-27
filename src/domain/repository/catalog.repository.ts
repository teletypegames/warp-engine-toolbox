/**
 * Port to the catalog part of a WarpEngine host's admin API.
 *
 * @module
 */
import type { SoftwareLink, Principal, Release, ScaffoldRequest, ScaffoldResult, Software } from '../model/catalog.model'

/**
 * Port to the software catalog of a WarpEngine host through its admin API: the signed-in
 * principal, the softwares, their releases, links and statistics, and the scaffolding of a new
 * software. Needs an admin token.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error, with
 * status `401` when the token is no longer accepted and `0` when the host cannot be reached.
 */
export interface CatalogRepository {
  /**
   * Fetches who the token belongs to.
   *
   * @returns The principal of the token.
   */
  me(): Promise<Principal>
  /**
   * Fetches the software statuses the host knows.
   *
   * @returns The statuses as the host sends them.
   */
  statuses(): Promise<unknown>
  /**
   * Lists the softwares of the catalog.
   *
   * @returns The softwares, at most one page of 200.
   */
  softwares(): Promise<Software[]>
  /**
   * Looks up one software by its exact name.
   *
   * @param name - The software name.
   * @returns The software, or `null` when the catalog has none of that name.
   */
  softwareByName(name: string): Promise<Software | null>
  /**
   * Changes fields of a software.
   *
   * @param id - The software id.
   * @param changes - The fields to change.
   * @returns The software as the host stored it.
   */
  updateSoftware(id: number, changes: Partial<Software>): Promise<Software>
  /**
   * Deletes a software from the catalog.
   *
   * @param id - The software id.
   */
  deleteSoftware(id: number): Promise<void>
  /**
   * Deletes one release of a software.
   *
   * @param id - The release id.
   */
  deleteRelease(id: number): Promise<void>
  /**
   * Lists the releases of a software, newest first.
   *
   * @param softwareId - The software id.
   * @returns The releases, at most one page of 200.
   */
  releases(softwareId: number): Promise<Release[]>
  /**
   * Lists the links (stores, pages) of a software; the source repository is not among them.
   *
   * @param softwareId - The software id.
   * @returns The links, at most one page of 200.
   */
  links(softwareId: number): Promise<SoftwareLink[]>
  /**
   * Fetches the download statistics of a software.
   *
   * @param softwareId - The software id.
   * @returns The statistics as the host sends them.
   */
  downloadStats(softwareId: number): Promise<unknown>
  /**
   * Has the host create a new software with its repository and CI.
   *
   * @param request - The name, platform and options of the new software.
   * @returns The created software and its repository.
   */
  scaffold(request: ScaffoldRequest): Promise<ScaffoldResult>
}
