/**
 * Checking metadata against the host before publishing.
 *
 * @module
 */
import { Metadata } from '../model/metadata.model'
import type { Project } from '../model/project.model'
import type { PublishCheck } from '../model/publish-check.model'
import type { ConnectionService } from './connection.service'
import type { ProjectService } from './project.service'

/** Asks the host what it would refuse in a project's metadata, for the diagnostics of the metadata file. */
export class PublishCheckService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the build API of the current host.
   * @param projects - Reads the project's version.
   */
  public constructor(private readonly connection: ConnectionService, private readonly projects: ProjectService) {}

  /**
   * Sends the edited metadata text and the project's version to the host's publish check, with the session's token when there is one.
   *
   * @param project - The project.
   * @param text - The current text of the metadata file, possibly unsaved.
   * @returns The host's verdict.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public async check(project: Project, text: string): Promise<PublishCheck> {
    const metadata: Metadata = Metadata.forCheck(text, project.metadataFormat)
    const version: string | null = await this.projects.version(project)
    const build = await this.connection.signedBuild()
    return build.check({ platform: project.platformName, metadata: { ...metadata.values }, version })
  }
}
