/**
 * Fork: a software of one engine cloned under a new name, its metadata pointing at its parent, ready to be connected
 * on a host the user can connect to.
 *
 * @module
 */
import { ForkNames } from '../model/fork-name.model'
import { Forks, type ForkOrigin, type PublicSoftware } from '../model/fork.model'
import { HostUrl, type Host } from '../model/host.model'
import { DomainError, msg, type Message } from '../model/message.model'
import { MetadataDocument } from '../model/metadata-document.model'
import { FilePath } from '../model/path.model'
import type { Project } from '../model/project.model'
import type { Session } from '../model/sign-in.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { AdminRepositories, WarpEngineGateway } from '../repository/warp-engine.gateway'
import type { CloneService } from './clone.service'
import type { HostService } from './host.service'
import type { ProjectService } from './project.service'
import type { SignInService } from './sign-in.service'

/** A host a fork can be connected to: one with a session, and who that session signs in as. */
export interface ForkTarget {
  /** The host. */
  readonly host: Host
  /** The label of the signed-in principal, or `null` when the host gives none. */
  readonly user: string | null
}

/** What {@link ForkService.fork} needs. */
export interface ForkInput {
  /** The software to fork, from the public catalog. */
  readonly original: PublicSoftware
  /** The base URL of the engine it is forked from. */
  readonly engine: string
  /** The fork's technical name, also its folder's name. */
  readonly name: string
  /** The fork's title. */
  readonly title: string
  /** The folder the fork's folder goes into. */
  readonly parent: string
  /** Called with each step, for the progress notification. */
  readonly report: (message: Message) => void
}

/** What {@link ForkService} works with. */
export interface ForkServiceDependencies {
  /** Opens the admin API of the target hosts. */
  readonly gateway: WarpEngineGateway
  /** The configured hosts. */
  readonly hosts: HostService
  /** The stored sessions of the hosts. */
  readonly signIn: SignInService
  /** Clones the original. */
  readonly clone: CloneService
  /** Detects the project in the clone. */
  readonly projects: ProjectService
  /** Renames the remote and commits. */
  readonly sourceControl: SourceControlFactory
  /** Rewrites the metadata file. */
  readonly files: FileSystemRepository
}

const UPSTREAM = 'upstream'
const ORIGIN = 'origin'
const MAX_CANDIDATES = 50

/** Finds where a fork can go and what it is called, and makes the fork: clone, remotes, metadata and the first commit. */
export class ForkService {
  /**
   * Creates the service.
   *
   * @param deps - The gateway, hosts, sessions, clone, project, git and file services it uses.
   */
  public constructor(private readonly deps: ForkServiceDependencies) {}

  /**
   * Checks that a software may be forked.
   *
   * @param original - The software, from the public catalog.
   * @throws {@link "domain/model/message.model".DomainError} When its host does not allow forking it.
   */
  public check(original: PublicSoftware): void {
    if (!Forks.canFork(original)) throw new DomainError(msg('{0} cannot be forked: its author does not allow it, or its source is not public.', original.title))
  }

  /**
   * Lists the configured hosts the user can connect a fork to: those with a stored session whose principal the host
   * still accepts. Hosts that refuse the token or do not answer are left out.
   *
   * @returns The targets, in the order of the host list.
   * @throws {@link "domain/model/message.model".DomainError} With the remedy `selectHost` when there is none.
   */
  public async targets(): Promise<ForkTarget[]> {
    const found: (ForkTarget | null)[] = await Promise.all(this.deps.hosts.choices().map(async (host: Host) => this.target(host)))
    const targets: ForkTarget[] = found.filter((target: ForkTarget | null): target is ForkTarget => target !== null)
    if (targets.length === 0) throw new DomainError(msg('Sign in to a WarpEngine host you can connect games to first: the fork goes there.'), 'selectHost')
    return targets
  }

  /**
   * Suggests the fork's name: `<name>-<user>`, then `-2`, `-3`, … while the target's catalog has the name.
   *
   * @param target - The target host.
   * @param original - The software being forked.
   * @returns The first free name.
   * @throws {@link "domain/model/message.model".DomainError} When the target has no session or no free name is found.
   */
  public async suggestName(target: ForkTarget, original: PublicSoftware): Promise<string> {
    const base: string = ForkNames.base(original.name, target.user)
    for (let index = 1; index <= MAX_CANDIDATES; index++) {
      const candidate: string = ForkNames.numbered(base, index)
      if (await this.isFree(target, candidate)) return candidate
    }
    throw new DomainError(msg('No free name found for the fork of {0} on {1}.', original.name, target.host.name))
  }

  /**
   * Tells whether the target's catalog has no software of a name.
   *
   * @param target - The target host.
   * @param name - The name.
   * @returns `true` when the name is free.
   * @throws {@link "domain/model/message.model".DomainError} When the target has no session.
   */
  public async isFree(target: ForkTarget, name: string): Promise<boolean> {
    return (await (await this.admin(target.host)).catalog.softwareByName(name)) === null
  }

  /**
   * Makes the fork: clones the original with its whole history into `<parent>/<name>`, renames `origin` to
   * `upstream`, rewrites the metadata ({@link domain/model/metadata-document.model!MetadataDocument.asFork}) and commits
   * "Fork of <title> from <engine>". There is no `origin` afterwards: Connect adds it.
   *
   * @param input - The original, its engine, the new name and title, the parent folder and the progress callback.
   * @returns The fork's project.
   * @throws {@link "domain/model/message.model".DomainError} When the clone fails, the folder is no WarpEngine project
   *   or its metadata cannot be rewritten; `Error` when git fails.
   */
  public async fork(input: ForkInput): Promise<Project> {
    const folder: string = await this.deps.clone.clone({ software: input.original, parent: input.parent, folderName: input.name, partial: false, report: input.report })
    const git: SourceControl = this.deps.sourceControl.at(folder)
    input.report(msg('pointing the fork at its upstream…'))
    if (await git.remoteUrl(ORIGIN)) await git.renameRemote(ORIGIN, UPSTREAM)
    const project: Project = await this.project(folder, input.name)
    await this.rewrite(project, input)
    await git.addAll()
    await git.commit(`Fork of ${input.original.title} from ${HostUrl.nameOf(input.engine)}`)
    return this.project(folder, input.name)
  }

  /**
   * Writes a licence into a project's metadata file, for a fork of a software that had none.
   *
   * @param project - The project.
   * @param license - The licence identifier, such as `MIT`.
   * @throws {@link "domain/model/message.model".DomainError} When the metadata file cannot be rewritten.
   */
  public async setLicense(project: Project, license: string): Promise<void> {
    const text: string | null = project.metadataPath ? await this.deps.files.readText(project.metadataPath) : null
    const updated: string | null = text === null ? null : new MetadataDocument(text, project.metadataFormat).withLicense(license)
    if (updated === null || !project.metadataPath) throw ForkService.unwritable(project)
    await this.deps.files.writeText(project.metadataPath, updated)
  }

  /**
   * Reads the project of a folder again, with the platforms of the current host.
   *
   * @param folder - The folder.
   * @param name - The folder's name.
   * @returns The project.
   * @throws {@link "domain/model/message.model".DomainError} When the folder has no WarpEngine marker.
   */
  public async project(folder: string, name: string = FilePath.basename(folder)): Promise<Project> {
    const project: Project | null = await this.deps.projects.detect({ path: folder, name })
    if (!project) throw new DomainError(msg('{0} has no WarpEngine marker file: it cannot be forked or connected from the toolbox.', folder))
    return project
  }

  private async rewrite(project: Project, input: ForkInput): Promise<void> {
    input.report(msg('writing the fork into the metadata…'))
    const origin: ForkOrigin = Forks.originOf(input.original, input.engine)
    const text: string | null = project.metadataPath ? await this.deps.files.readText(project.metadataPath) : null
    const updated: string | null = text === null ? null : new MetadataDocument(text, project.metadataFormat).asFork({ name: input.name, title: input.title, origin })
    if (updated === null || !project.metadataPath) throw ForkService.unwritable(project)
    await this.deps.files.writeText(project.metadataPath, updated)
  }

  private async target(host: Host): Promise<ForkTarget | null> {
    const session: Session | undefined = (await this.deps.signIn.forHost(host.url))[0]
    if (!session) return null
    try {
      return { host, user: (await this.deps.gateway.admin(host.url, session.token).catalog.me()).label }
    } catch {
      return null
    }
  }

  private async admin(host: Host): Promise<AdminRepositories> {
    const session: Session | undefined = (await this.deps.signIn.forHost(host.url))[0]
    if (!session) throw new DomainError(msg('Sign in to {0} first.', host.name), 'selectHost')
    return this.deps.gateway.admin(host.url, session.token)
  }

  private static unwritable(project: Project): DomainError {
    return new DomainError(msg('The metadata of {0} cannot be rewritten here: fix it in the text editor first.', project.folder), 'editMetadata')
  }
}
