import type { LocalComponent, LocalCredentials, LocalOperation } from '../../domain/model/local-ci.model'
import type { LocalComponentRepository } from '../../domain/repository/local-component.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

export class HttpLocalComponentRepository implements LocalComponentRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async components(): Promise<LocalComponent[]> {
    return this.client.admin<LocalComponent[]>('GET', '/local_components')
  }

  public async enable(key: string): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('POST', `/local_components/${encodeURIComponent(key)}/enable`)
  }

  public async disable(key: string): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('POST', `/local_components/${encodeURIComponent(key)}/disable`)
  }

  public async remove(key: string, purge: boolean): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('DELETE', `/local_components/${encodeURIComponent(key)}${purge ? '?purge=true' : ''}`)
  }

  public async operation(id: number): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('GET', `/local_operations/${String(id)}`)
  }

  public async credentials(key: string): Promise<LocalCredentials> {
    return this.client.admin<LocalCredentials>('GET', `/local_components/${encodeURIComponent(key)}/credentials`)
  }

  public async setUpCi(softwareId: number): Promise<LocalOperation> {
    return this.client.admin<LocalOperation>('POST', `/softwares/${String(softwareId)}/local_ci`)
  }
}
