/**
 * Releasing a version: bump, changelog, tag, push.
 *
 * @module
 */
import { Changelog } from '../model/changelog.model'
import type { Commit } from '../model/commit.model'
import type { GitRemote } from '../model/git-remote.model'
import { msg, type Message } from '../model/message.model'
import { MetadataDocument } from '../model/metadata-document.model'
import { FilePath } from '../model/path.model'
import type { Project } from '../model/project.model'
import { PublishChecks, type PublishCheck, type PublishProblem } from '../model/publish-check.model'
import { Version } from '../model/version.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'
import type { ProjectService } from './project.service'

/** Whether a project can be released now: `unconnected` (no repository or remote), `dirty` (uncommitted changes), `unwritable` (no file to write the version into) or `ready`. */
export type Readiness = 'unconnected' | 'dirty' | 'unwritable' | 'ready'
/** The kind of version to offer: a stable one or a beta. */
export type ReleaseKind = 'stable' | 'beta'

/** What {@link ReleaseService} works with. */
export interface ReleaseDependencies {
  /** Opens the git repository of the project. */
  readonly sourceControl: SourceControlFactory
  /** Reads and writes the version and changelog files. */
  readonly files: FileSystemRepository
  /** Gives the build API for the publish check. */
  readonly connection: ConnectionService
  /** Reads the current version. */
  readonly projects: ProjectService
}

/** What {@link ReleaseService.release} needs. */
export interface ReleaseInput {
  /** The project to release. */
  readonly project: Project
  /** The new version, without `v`. */
  readonly version: string
  /** The git remote to push the tag to. */
  readonly remote: string
  /** Called with each step, for the progress notification. */
  readonly report: (message: Message) => void
}

const CHANGELOG = 'CHANGELOG.md'

/** Decides whether and which version can be released, and releases it: writes the version and changelog, commits, tags and pushes the tag, which has the CI build and publish it. */
export class ReleaseService {
  private readonly sourceControl: SourceControlFactory
  private readonly files: FileSystemRepository
  private readonly connection: ConnectionService
  private readonly projects: ProjectService

  /**
   * Creates the service.
   *
   * @param deps - Git, the file system, the connection and the project service.
   */
  public constructor(deps: ReleaseDependencies) {
    this.sourceControl = deps.sourceControl
    this.files = deps.files
    this.connection = deps.connection
    this.projects = deps.projects
  }

  /**
   * Tells whether the project can be released now.
   *
   * @param project - The project.
   * @returns The readiness, checked in the order of {@link Readiness}.
   * @throws When git cannot tell whether the work tree is clean.
   */
  public async readiness(project: Project): Promise<Readiness> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    if (!(await git.isRepository()) || (await git.remotes()).length === 0) return 'unconnected'
    if (!(await git.isClean())) return 'dirty'
    return project.versionWritable ? 'ready' : 'unwritable'
  }

  /**
   * Stages and commits every change as "Work before the release".
   *
   * @param project - The project.
   * @throws When a git command fails.
   */
  public async commitWork(project: Project): Promise<void> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    await git.addAll()
    await git.commit('Work before the release')
  }

  /**
   * Reads the current version of the project.
   *
   * @param project - The project.
   * @returns The version; `0.0.0` when none can be read.
   */
  public async currentVersion(project: Project): Promise<string> {
    return (await this.projects.version(project)) ?? '0.0.0'
  }

  /**
   * Lists the versions that may follow the current one.
   *
   * @param current - The current version.
   * @param kind - Stable or beta.
   * @returns The candidate versions.
   */
  public candidates(current: string, kind: ReleaseKind): string[] {
    const version: Version = new Version(current)
    return kind === 'beta' ? version.betaCandidates() : version.stableCandidates()
  }

  /**
   * Runs the host's publish check with the new version in the metadata.
   *
   * @param project - The project.
   * @param version - The version to release.
   * @returns The errors that would make the host refuse the release; empty when the check passes or the host cannot be asked.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public async verify(project: Project, version: string): Promise<PublishProblem[]> {
    const metadata = { ...project.metadata.values, version }
    const check: PublishCheck | null = await this.connection.build()
      .check({ platform: project.platformName, metadata, version }).catch(() => null)
    return PublishChecks.errors(check)
  }

  /**
   * Releases a version: writes it into the version or metadata file (and into a `package.json`
   * that names a version, so the two stay in step), prepends a `CHANGELOG.md`
   * entry from the commits since the last tag, commits, creates the annotated tag `v<version>`
   * and pushes `HEAD` and the tag to the remote.
   *
   * @param input - The project, version, remote and progress callback.
   * @throws When a git command or a file write fails.
   */
  public async release(input: ReleaseInput): Promise<void> {
    const git: SourceControl = this.sourceControl.at(input.project.folder)
    input.report(msg('writing the version and the changelog…'))
    await this.writeVersion(input.project, input.version)
    const entry: string = await this.writeChangelog(input.project, input.version, git)
    await git.addAll()
    await git.commit(`Release ${input.version}`)
    await git.tag(`v${input.version}`, entry)
    input.report(msg('pushing the tag: the CI builds and publishes it…'))
    await git.push([input.remote, 'HEAD', `v${input.version}`])
  }

  /**
   * Lists the git remotes of the project.
   *
   * @param project - The project.
   * @returns The remotes; empty when the folder is no repository.
   */
  public async remotes(project: Project): Promise<GitRemote[]> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    return await git.isRepository() ? git.remotes() : []
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
    await this.syncPackageVersion(project, version)
  }

  private async syncPackageVersion(project: Project, version: string): Promise<void> {
    const path: string = FilePath.join(project.folder, 'package.json')
    const text: string | null = await this.files.readText(path)
    if (text === null || !MetadataDocument.jsonHasVersion(text)) return
    await this.files.writeText(path, MetadataDocument.jsonWithVersion(text, version))
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
