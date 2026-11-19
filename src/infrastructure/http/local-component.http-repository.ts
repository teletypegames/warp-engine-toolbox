import type { LocalComponent, LocalOperation } from '../../domain/model/local-ci.model'
import type { LocalComponentRepository } from '../../domain/repository/local-component.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

export class HttpLocalComponentRepository implements LocalComponentRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async components(): Promise<LocalComponent[]> {
    return this.client.admin<LocalComponent[]>('GET', '/local_components')
  }

  public async operation(id: number): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('GET', `/local_operations/${String(id)}`)
  }

  public async setUpCi(softwareId: number): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('POST', `/softwares/${String(softwareId)}/local_ci`)
  }
}
