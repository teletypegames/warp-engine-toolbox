import type { Pipeline, PipelineRun } from '../model/pipeline.model'
import type { Project } from '../model/project.model'
import type { SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

const DEFAULT_BRANCH = 'master'

export class PipelineService {
  public constructor(private readonly connection: ConnectionService, private readonly sourceControl: SourceControlFactory) {}

  public async preview(project: Project): Promise<string> {
    return this.connection.build().pipelinePreview(project.platformName, project.marker.name ?? project.name)
  }

  public async trigger(pipeline: Pipeline, project: Project | null): Promise<{ run: PipelineRun; branch: string } | null> {
    const admin = await this.connection.admin(true)
    if (!admin) return null
    const branch: string = (project ? await this.sourceControl.at(project.folder).branch() : null) ?? DEFAULT_BRANCH
    return { run: await admin.pipelines.trigger(pipeline.id, branch), branch }
  }
}
