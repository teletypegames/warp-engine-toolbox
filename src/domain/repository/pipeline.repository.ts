import type { Pipeline, PipelineRun } from '../model/pipeline.model'

export interface PipelineRepository {
  pipelines(): Promise<Pipeline[]>
  runs(pipelineId: number): Promise<PipelineRun[]>
  trigger(pipelineId: number, branch: string): Promise<PipelineRun>
}
