import type { WellKnown } from '../model/local-engine.model'

export interface DiscoveryRepository {
  probe(url: string): Promise<WellKnown | null>
}
