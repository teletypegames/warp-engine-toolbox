/**
 * The {@link domain/repository/discovery.repository!DiscoveryRepository} port implemented with a `.well-known` probe.
 *
 * @module
 */
import { LocalEngine, type WellKnown } from '../../domain/model/local-engine.model'
import type { DiscoveryRepository } from '../../domain/repository/discovery.repository'
import { Loopback } from './loopback'

const PROBE_TIMEOUT_MS = 1500
const PATH = '/.well-known/warp-engine'

/**
 * Finds out whether a URL serves a WarpEngine by fetching its `/.well-known/warp-engine` document.
 */
export class HttpDiscoveryRepository implements DiscoveryRepository {
  /**
   * Fetches `/.well-known/warp-engine` of a URL with a 1.5-second timeout; never throws.
   *
   * @param url - The base URL to probe; trailing slashes are removed.
   * @returns The document when it is a valid {@link domain/model/local-engine.model!WellKnown}; `null` when the request fails or the answer is not one.
   */
  public async probe(url: string): Promise<WellKnown | null> {
    try {
      const response: Response = await fetch(Loopback.reach(`${url.replace(/\/+$/, '')}${PATH}`), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      if (!response.ok) return null
      const body: unknown = await response.json()
      return LocalEngine.isWellKnown(body) ? body : null
    } catch {
      return null
    }
  }
}
