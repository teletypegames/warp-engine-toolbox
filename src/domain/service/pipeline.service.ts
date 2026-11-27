/**
 * The CI pipeline of a project.
 *
 * @module
 */
import type { CiRepository, PipelineRun } from '../model/pipeline.model'
import type { Project } from '../model/project.model'
import type { SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

const DEFAULT_BRANCH = 'master'

/** Previews the CI configuration of a project and starts pipeline runs. */
export class PipelineService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the repositories of the current host.
   * @param sourceControl - Reads the project's current branch.
   */
  public constructor(private readonly connection: ConnectionService, private readonly sourceControl: SourceControlFactory) {}

  /**
   * Fetches the CI configuration the host generates for a project.
   *
   * @param project - The project.
   * @returns The configuration as YAML text.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public async preview(project: Project): Promise<string> {
    return this.connection.build().pipelinePreview(project.platformName, project.marker.name ?? project.name)
  }

  /**
   * Starts a pipeline run of a CI repository on the branch the project has checked out (`master` without a project or branch); signs in when needed.
   *
   * @param ciRepository - The CI repository.
   * @param project - The project to take the branch from, or `null`.
   * @returns The started run and its branch, or `null` when no session can be had.
   */
  public async trigger(ciRepository: CiRepository, project: Project | null): Promise<{
    /** The started run. */
    run: PipelineRun
    /** The branch it builds. */
    branch: string
  } | null> {
    const admin = await this.connection.admin(true)
    if (!admin) return null
    const branch: string = (project ? await this.sourceControl.at(project.folder).branch() : null) ?? DEFAULT_BRANCH
    return { run: await admin.pipelines.trigger(ciRepository.id, branch), branch }
  }
}
