/**
 * Connecting a local project to the catalog: Publish to WarpEngine.
 *
 * @module
 */
import type { ScaffoldResult } from '../model/catalog.model'
import { DomainError, msg, type Message } from '../model/message.model'
import { MetadataDocument } from '../model/metadata-document.model'
import type { Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

/** A git remote URL the user can pick for the new repository. */
export interface RemoteOption {
  /** How the option is shown: `SSH` or `HTTPS`. */
  readonly label: string
  /** The remote URL. */
  readonly url: string
}

/** What {@link ConnectService.attach} needs to tie a project to its new repository. */
export interface AttachInput {
  /** The local project. */
  readonly project: Project
  /** What the host created for it. */
  readonly scaffold: ScaffoldResult
  /** The remote URL to push to, or `null` to only commit locally. */
  readonly remote: string | null
  /** Called with each step, for the progress notification. */
  readonly report: (message: Message) => void
}

const FIRST_BRANCH = 'master'

/** Registers a local project on the host (software, repository, CI) and points its working copy at the new repository. */
export class ConnectService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the admin repositories of the current host.
   * @param sourceControl - Opens the git repository of the project.
   * @param files - Reads and writes the project's metadata file.
   */
  public constructor(
    private readonly connection: ConnectionService,
    private readonly sourceControl: SourceControlFactory,
    private readonly files: FileSystemRepository
  ) {}

  /**
   * Signs in to the current host, starting the sign-in flow when there is no session.
   *
   * @returns `true` when a session exists afterwards.
   */
  public async signIn(): Promise<boolean> {
    return (await this.connection.admin(true)) !== null
  }

  /**
   * Reads the `origin` URL of the project, to warn before replacing it.
   *
   * @param project - The project.
   * @returns The URL, or `null` when the folder is no repository or has no `origin`.
   */
  public async existingRemote(project: Project): Promise<string | null> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    return await git.isRepository() ? git.remote() : null
  }

  /**
   * Has the host create the software, its repository and CI from the project's name, title, platform, category and description; signs in when needed.
   *
   * @param project - The project.
   * @returns What the host created.
   * @throws {@link "domain/model/message.model".DomainError} When no session can be had.
   */
  public async scaffold(project: Project): Promise<ScaffoldResult> {
    const admin = await this.connection.admin(true)
    if (!admin) throw new DomainError(msg('Sign in first.'), 'signIn')
    const title: string = project.title
    return admin.catalog.scaffold({
      name: project.name, title, platform: project.platformName,
      category: project.metadata.trimmed('category'), description: project.metadata.trimmed('desc') ?? title
    })
  }

  /**
   * Lists the remote URLs the new repository offers.
   *
   * @param scaffold - What the host created.
   * @returns SSH first, then HTTPS, as far as the host gave them.
   */
  public remoteOptions(scaffold: ScaffoldResult): RemoteOption[] {
    const options: RemoteOption[] = []
    if (scaffold.repository.sshUrl) options.push({ label: 'SSH', url: scaffold.repository.sshUrl })
    if (scaffold.repository.cloneUrl) options.push({ label: 'HTTPS', url: scaffold.repository.cloneUrl })
    return options
  }

  /**
   * Ties the project to its new repository: writes the repository URL into the metadata file,
   * runs `git init` when needed, sets `origin`, commits everything and pushes, which starts the
   * first build. Without a remote it stops after the commit.
   *
   * @param input - The project, the scaffold result, the remote and the progress callback.
   * @throws When a git command fails.
   */
  public async attach(input: AttachInput): Promise<void> {
    const git: SourceControl = this.sourceControl.at(input.project.folder)
    input.report(msg('pointing the working copy at it…'))
    await this.recordRepository(input.project, input.scaffold.repository.htmlUrl)
    if (!(await git.isRepository())) await git.init(FIRST_BRANCH)
    if (input.remote) await git.setRemote(input.remote)
    await git.addAll()
    if (!(await git.isClean()) || !(await git.hasCommits())) await git.commit(`Start ${input.project.title} on WarpEngine`)
    if (!input.remote) return
    input.report(msg('pushing: the first build starts…'))
    await git.push(['-u', 'origin', (await git.branch()) ?? FIRST_BRANCH])
  }

  private async recordRepository(project: Project, url: string | null): Promise<void> {
    if (!url || !project.metadataPath) return
    const text: string | null = await this.files.readText(project.metadataPath)
    if (text === null) return
    const updated: string | null = new MetadataDocument(text, project.metadataFormat).withRepository(url)
    if (updated !== null) await this.files.writeText(project.metadataPath, updated)
  }
}
