import type { LocalComponent, LocalCredentials, LocalOperation } from '../model/local-ci.model'

export interface LocalComponentRepository {
  components(): Promise<LocalComponent[]>
  enable(key: string): Promise<LocalOperation>
  disable(key: string): Promise<LocalOperation>
  remove(key: string, purge: boolean): Promise<LocalOperation>
  operation(id: number): Promise<LocalOperation>
  setUpCi(softwareId: number): Promise<LocalOperation>
  credentials(key: string): Promise<LocalCredentials>
}
