/**
 * Port to the public catalog (WECP) of a WarpEngine host: the softwares with their source, and their forks.
 *
 * @module
 */
import type { PublicSoftware, SoftwareFork } from '../model/fork.model'

/**
 * Port to the public catalog of a WarpEngine host, readable without signing in. The fields a host older than WECP
 * `api: 3` does not send come back empty: no source, forking not allowed, no forks counted.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error,
 * with status `0` when it cannot be reached.
 */
export interface PublicCatalogRepository {
  /**
   * Lists every software of the catalog the caller may see.
   *
   * @returns The softwares.
   */
  softwares(): Promise<PublicSoftware[]>
  /**
   * Looks up one software by its exact name.
   *
   * @param name - The software name.
   * @returns The software, or `null` when the catalog shows none of that name.
   */
  software(name: string): Promise<PublicSoftware | null>
  /**
   * Lists the visible forks of a software.
   *
   * @param name - The software name.
   * @returns The forks; empty when the host lists none or does not know the endpoint.
   */
  forks(name: string): Promise<SoftwareFork[]>
}
