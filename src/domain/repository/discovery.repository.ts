/**
 * Port that finds WarpEngine hosts by their well-known document.
 *
 * @module
 */
import type { WellKnown } from '../model/local-engine.model'

/** Port that probes a URL for a WarpEngine host. */
export interface DiscoveryRepository {
  /**
   * Reads the `/.well-known/warp-engine` document of a URL, with a short timeout. Never rejects.
   *
   * @param url - The base URL to probe.
   * @returns The document, or `null` when nothing answers, the answer is an error or it is not a WarpEngine document.
   */
  probe(url: string): Promise<WellKnown | null>
}
