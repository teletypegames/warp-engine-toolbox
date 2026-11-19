/**
 * Port to the stored WarpEngine host settings.
 *
 * @module
 */
import type { Host } from '../model/host.model'

/** Port to the user settings that name the current WarpEngine host and the known ones. */
export interface HostRepository {
  /**
   * Reads the URL of the current host.
   *
   * @returns The URL as configured; empty when none is set.
   */
  configuredUrl(): string
  /**
   * Reads the list of known hosts.
   *
   * @returns The hosts; empty when none is set.
   */
  configuredHosts(): Host[]
  /**
   * Stores the URL of the current host in the user (global) settings.
   *
   * @param url - The host URL.
   */
  saveUrl(url: string): Promise<void>
  /**
   * Stores the list of known hosts in the user (global) settings, replacing it.
   *
   * @param hosts - The complete list.
   */
  saveHosts(hosts: readonly Host[]): Promise<void>
}
