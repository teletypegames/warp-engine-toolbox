/**
 * What the host knows about a project.
 *
 * @module
 */
import { Releases, type Release, type Software } from '../model/catalog.model'
import type { CiRepository, PipelineRun } from '../model/pipeline.model'
import type { Project } from '../model/project.model'
import { HostError } from '../model/host-error.model'
import { RemoteStates, type GitPosition, type RemoteState } from '../model/remote-state.model'
import { Version } from '../model/version.model'
import type { AdminRepositories } from '../repository/warp-engine.gateway'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

const DEFAULT_BRANCH = 'master'

/** Loads the remote state of a project: its git position, and from the host its software, pipeline, runs and releases. */
export class RemoteStateService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the admin repositories of the current host.
   * @param sourceControl - Reads the project's git position.
   */
  public constructor(private readonly connection: ConnectionService, private readonly sourceControl: SourceControlFactory) {}

  /**
   * Loads the remote state of a project without asking the user. Never rejects because of the
   * host: a host error is recorded in the state, flagged `unauthorized` on a 401.
   *
   * @param project - The project.
   * @returns The state; only the git position and `signedIn: false` without a session.
   */
  public async load(project: Project): Promise<RemoteState> {
    const position: GitPosition = await this.position(this.sourceControl.at(project.folder))
    const admin: AdminRepositories | null = await this.connection.admin(false)
    const empty: RemoteState = RemoteStates.empty(project, position, admin !== null)
    if (!admin) return empty
    try {
      return await this.fill(empty, admin)
    } catch (error: unknown) {
      return { ...empty, error: error instanceof Error ? error.message : String(error), unauthorized: HostError.isUnauthorized(error) }
    }
  }

  private async position(git: SourceControl): Promise<GitPosition> {
    return { head: await git.head(), branch: await git.branch(), defaultBranch: await git.defaultBranch() }
  }

  private async fill(empty: RemoteState, admin: AdminRepositories): Promise<RemoteState> {
    const software: Software | null = await admin.catalog.softwareByName(empty.project.name)
    const ciRepository: CiRepository | null = software ? await this.ciRepository(admin, software, empty.project) : null
    const runs: PipelineRun[] = ciRepository ? await admin.pipelines.runs(ciRepository.id).catch((): PipelineRun[] => []) : []
    const headRun: PipelineRun | null = runs.find((run: PipelineRun) => run.commit !== null && run.commit === empty.head) ?? null
    const releases: Release[] = software ? await admin.catalog.releases(software.id).catch((): Release[] => []) : []
    return { ...empty, software, ciRepository, runs, headRun, releases, branchBuild: this.branchBuild(empty, releases) }
  }

  private async ciRepository(admin: AdminRepositories, software: Software, project: Project): Promise<CiRepository | null> {
    const repositories: CiRepository[] = await admin.pipelines.repositories().catch((): CiRepository[] => [])
    return repositories.find((candidate: CiRepository) => candidate.softwareId === software.id)
      ?? repositories.find((candidate: CiRepository) => candidate.repoName === project.name) ?? null
  }

  private branchBuild(position: GitPosition, releases: readonly Release[]): Release | null {
    const { branch, defaultBranch } = position
    if (!branch || branch === (defaultBranch ?? DEFAULT_BRANCH) || branch === 'HEAD') return null
    const devBranch: string = branch.replace(/\//g, '-')
    return releases.find((release: Release) => Releases.isDev(release) && Version.devBuildBranch(release.version) === devBranch) ?? null
  }
}
