import type { LocalComponent, LocalOperation } from '../model/local-ci.model'

export interface LocalComponentRepository {
  components(): Promise<LocalComponent[]>
  operation(id: number): Promise<LocalOperation>
  setUpCi(softwareId: number): Promise<LocalOperation>
}
