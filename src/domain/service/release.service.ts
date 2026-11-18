import { Changelog } from '../model/changelog.model'
import type { Commit } from '../model/commit.model'
import { msg, type Message } from '../model/message.model'
import { MetadataDocument } from '../model/metadata-document.model'
import { FilePath } from '../model/path.model'
import type { Project } from '../model/project.model'
import { publishErrors, type PublishCheck, type PublishProblem } from '../model/publish-check.model'
import { Version } from '../model/version.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'
import type { ProjectService } from './project.service'

export type Readiness = 'unconnected' | 'dirty' | 'unwritable' | 'ready'
export type ReleaseKind = 'stable' | 'beta'

export interface ReleaseInput {
  readonly project: Project
  readonly version: string
  readonly report: (message: Message) => void
}

const CHANGELOG = 'CHANGELOG.md'

export class ReleaseService {
  public constructor(
    private readonly sourceControl: SourceControlFactory,
    private readonly files: FileSystemRepository,
    private readonly connection: ConnectionService,
    private readonly projects: ProjectService
  ) {}

  public async readiness(project: Project): Promise<Readiness> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    if (!(await git.isRepository()) || !(await git.remote())) return 'unconnected'
    if (!(await git.isClean())) return 'dirty'
    return project.versionWritable ? 'ready' : 'unwritable'
  }

  public async commitWork(project: Project): Promise<void> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    await git.addAll()
    await git.commit('Work before the release')
  }

  public async currentVersion(project: Project): Promise<string> {
    return (await this.projects.version(project)) ?? '0.0.0'
  }

  public candidates(current: string, kind: ReleaseKind): string[] {
    const version: Version = new Version(current)
    return kind === 'beta' ? version.betaCandidates() : version.stableCandidates()
  }

  public async verify(project: Project, version: string): Promise<PublishProblem[]> {
    const metadata = { ...project.metadata.values, version }
    const check: PublishCheck | null = await this.connection.build()
      .check({ platform: project.platformName, metadata, version }).catch(() => null)
    return publishErrors(check)
  }

  public async release(input: ReleaseInput): Promise<void> {
    const git: SourceControl = this.sourceControl.at(input.project.folder)
    input.report(msg('writing the version and the changelog…'))
    await this.writeVersion(input.project, input.version)
    const entry: string = await this.writeChangelog(input.project, input.version, git)
    await git.addAll()
    await git.commit(`Release ${input.version}`)
    await git.tag(`v${input.version}`, entry)
    input.report(msg('pushing the tag: the CI builds and publishes it…'))
    await git.push(['origin', 'HEAD', `v${input.version}`])
  }

  private async writeVersion(project: Project, version: string): Promise<void> {
    const versionFile: string | null = project.platform?.versionFile ?? null
    if (versionFile) {
      const path: string = FilePath.join(project.folder, versionFile)
      await this.files.writeText(path, MetadataDocument.jsonWithVersion((await this.files.readText(path)) ?? '{}', version))
      return
    }
    if (!project.metadataPath) return
    const text: string = (await this.files.readText(project.metadataPath)) ?? ''
    await this.files.writeText(project.metadataPath, new MetadataDocument(text, project.metadataFormat).withVersion(version))
  }

  private async writeChangelog(project: Project, version: string, git: SourceControl): Promise<string> {
    await git.fetchTags()
    const commits: Commit[] = await git.commitsSince(await git.lastTag())
    const entry: string = Changelog.entry(version, commits, new Date().toISOString().slice(0, 10))
    const path: string = FilePath.join(project.folder, CHANGELOG)
    await this.files.writeText(path, Changelog.prepend(await this.files.readText(path), entry))
    return entry
  }
}
