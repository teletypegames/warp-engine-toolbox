import { Metadata } from '../model/metadata.model'
import type { Project } from '../model/project.model'
import type { PublishCheck } from '../model/publish-check.model'
import type { ConnectionService } from './connection.service'
import type { ProjectService } from './project.service'

export class PublishCheckService {
  public constructor(private readonly connection: ConnectionService, private readonly projects: ProjectService) {}

  public async check(project: Project, text: string): Promise<PublishCheck> {
    const metadata: Metadata = Metadata.forCheck(text, project.metadataFormat)
    const version: string | null = await this.projects.version(project)
    const build = await this.connection.signedBuild()
    return build.check({ platform: project.platformName, metadata: { ...metadata.values }, version })
  }
}
