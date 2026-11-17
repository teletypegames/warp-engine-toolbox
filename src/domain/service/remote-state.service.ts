import type { Release, Software } from '../model/catalog.model'
import { isDevRelease } from '../model/catalog.model'
import type { Pipeline, PipelineRun } from '../model/pipeline.model'
import type { Project } from '../model/project.model'
import { emptyRemoteState, type GitPosition, type RemoteState } from '../model/remote-state.model'
import { Version } from '../model/version.model'
import type { AdminRepositories } from '../repository/warp-engine.gateway'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

const DEFAULT_BRANCH = 'master'

export class RemoteStateService {
  public constructor(private readonly connection: ConnectionService, private readonly sourceControl: SourceControlFactory) {}

  public async load(project: Project): Promise<RemoteState> {
    const position: GitPosition = await this.position(this.sourceControl.at(project.folder))
    const admin: AdminRepositories | null = await this.connection.admin(false)
    const empty: RemoteState = emptyRemoteState(project, position, admin !== null)
    if (!admin) return empty
    try {
      return await this.fill(empty, admin)
    } catch (error: unknown) {
      return { ...empty, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async position(git: SourceControl): Promise<GitPosition> {
    return { head: await git.head(), branch: await git.branch(), defaultBranch: await git.defaultBranch() }
  }

  private async fill(empty: RemoteState, admin: AdminRepositories): Promise<RemoteState> {
    const software: Software | null = await admin.catalog.softwareByName(empty.project.name)
    const pipeline: Pipeline | null = software ? await this.pipeline(admin, software, empty.project) : null
    const runs: PipelineRun[] = pipeline ? await admin.pipelines.runs(pipeline.id).catch((): PipelineRun[] => []) : []
    const headRun: PipelineRun | null = runs.find((run: PipelineRun) => run.commit !== null && run.commit === empty.head) ?? null
    const releases: Release[] = software ? await admin.catalog.releases(software.id).catch((): Release[] => []) : []
    return { ...empty, software, pipeline, runs, headRun, releases, branchBuild: this.branchBuild(empty, releases) }
  }

  private async pipeline(admin: AdminRepositories, software: Software, project: Project): Promise<Pipeline | null> {
    const pipelines: Pipeline[] = await admin.pipelines.pipelines().catch((): Pipeline[] => [])
    return pipelines.find((candidate: Pipeline) => candidate.softwareId === software.id)
      ?? pipelines.find((candidate: Pipeline) => candidate.repoName === project.name) ?? null
  }

  private branchBuild(position: GitPosition, releases: readonly Release[]): Release | null {
    const { branch, defaultBranch } = position
    if (!branch || branch === (defaultBranch ?? DEFAULT_BRANCH) || branch === 'HEAD') return null
    const devBranch: string = branch.replace(/\//g, '-')
    return releases.find((release: Release) => isDevRelease(release) && Version.devBuildBranch(release.version) === devBranch) ?? null
  }
}
