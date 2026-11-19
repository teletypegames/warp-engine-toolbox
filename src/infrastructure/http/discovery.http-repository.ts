import { LocalEngine, type WellKnown } from '../../domain/model/local-engine.model'
import type { DiscoveryRepository } from '../../domain/repository/discovery.repository'

const PROBE_TIMEOUT_MS = 1500
const PATH = '/.well-known/warp-engine'

export class DiscoveryHttpRepository implements DiscoveryRepository {
  public async probe(url: string): Promise<WellKnown | null> {
    try {
      const response: Response = await fetch(`${url.replace(/\/+$/, '')}${PATH}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      if (!response.ok) return null
      const body: unknown = await response.json()
      return LocalEngine.isWellKnown(body) ? body : null
    } catch {
      return null
    }
  }
}
