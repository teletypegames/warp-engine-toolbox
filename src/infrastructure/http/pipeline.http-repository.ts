import type { Pipeline, PipelineRun } from '../../domain/model/pipeline.model'
import type { PipelineRepository } from '../../domain/repository/pipeline.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

export class HttpPipelineRepository implements PipelineRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async pipelines(): Promise<Pipeline[]> {
    return this.client.adminList<Pipeline>('/pipelines', { perPage: '200' })
  }

  public async runs(pipelineId: number): Promise<PipelineRun[]> {
    return this.client.admin<PipelineRun[]>('GET', `/pipelines/${String(pipelineId)}/runs`)
  }

  public async trigger(pipelineId: number, branch: string): Promise<PipelineRun> {
    return this.client.admin<PipelineRun>('POST', `/pipelines/${String(pipelineId)}/trigger`, { branch })
  }
}
