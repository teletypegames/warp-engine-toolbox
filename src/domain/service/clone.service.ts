/**
 * Clone: a software's source from the public catalog of the current host, cloned into a local folder.
 *
 * @module
 */
import { DevContainer } from '../model/dev-container.model'
import { Forks, type CloneAddress, type PublicSoftware, type SoftwareFork, type SoftwareSource } from '../model/fork.model'
import { GitFailures } from '../model/git-failure.model'
import { GitRemotes } from '../model/git-remote.model'
import { DomainError, msg, type Message } from '../model/message.model'
import { FilePath } from '../model/path.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

/** What {@link CloneService.clone} clones and where. */
export interface CloneInput {
  /** The software, with its source. */
  readonly software: PublicSoftware
  /** The folder the clone's folder goes into. */
  readonly parent: string
  /** The name of the clone's folder. */
  readonly folderName: string
  /** `true` leaves the blobs of the history on the remote (`--filter=blob:none`); a fork clones everything. */
  readonly partial: boolean
  /** Called with each step, for the progress notification. */
  readonly report: (message: Message) => void
}

/** Reads the softwares, sources and forks of the current host's public catalog and clones a source. */
export class CloneService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the public catalog of the current host.
   * @param sourceControl - Clones and probes the remotes.
   * @param files - Tells whether the target folder exists.
   */
  public constructor(
    private readonly connection: ConnectionService,
    private readonly sourceControl: SourceControlFactory,
    private readonly files: FileSystemRepository
  ) {}

  /**
   * Reads every software of the public catalog, keyed by name; anything the host cannot answer gives an empty map.
   *
   * @returns The softwares by name.
   */
  public async softwares(): Promise<ReadonlyMap<string, PublicSoftware>> {
    if (!this.connection.hasHost()) return new Map<string, PublicSoftware>()
    const list: PublicSoftware[] = await (await this.connection.publicCatalog()).softwares().catch((): PublicSoftware[] => [])
    return new Map(list.map((software: PublicSoftware) => [software.name, software]))
  }

  /**
   * Looks up one software in the public catalog.
   *
   * @param name - The software name.
   * @returns The software.
   * @throws {@link "domain/model/message.model".DomainError} When the public catalog shows no software of that name.
   */
  public async software(name: string): Promise<PublicSoftware> {
    const found: PublicSoftware | null = await (await this.connection.publicCatalog()).software(name)
    if (!found) throw new DomainError(msg('The public catalog of {0} does not show {1}.', this.connection.hostUrl(), name))
    return found
  }

  /**
   * Lists the forks of a software on the current host.
   *
   * @param name - The software name.
   * @returns The forks.
   */
  public async forks(name: string): Promise<SoftwareFork[]> {
    return (await this.connection.publicCatalog()).forks(name)
  }

  /**
   * Gives the base URL of the current host, the engine a clone or a fork comes from.
   *
   * @returns The URL without a trailing slash.
   */
  public engineUrl(): string {
    return this.connection.hostUrl()
  }

  /**
   * Clones the software's source into `<parent>/<folderName>`: over SSH when the source offers it and it answers without
   * asking, over HTTPS otherwise.
   *
   * @param input - The software, the folders, whether the clone is partial and the progress callback.
   * @returns The folder of the clone.
   * @throws {@link "domain/model/message.model".DomainError} With the remedy `retryClone` when there is no source, the
   *   folder exists, or git cannot reach, sign in to or find the repository.
   */
  public async clone(input: CloneInput): Promise<string> {
    const source: SoftwareSource | null = input.software.source
    if (!source) throw new DomainError(msg('{0} gives no source to clone.', input.software.title))
    const folder: string = FilePath.join(input.parent, input.folderName)
    if (await this.files.exists(folder)) throw new DomainError(msg('{0} exists already: choose another folder, or remove it first.', folder), 'retryClone')
    const address: CloneAddress = await this.address(source, input.report)
    input.report(msg('cloning {0} over {1}…', GitRemotes.display(address.url), address.protocol))
    try {
      await this.sourceControl.clone({ url: address.url, folder, ref: source.ref, partial: input.partial })
    } catch (error: unknown) {
      throw CloneService.failure(address.url, error)
    }
    return folder
  }

  /**
   * Tells whether a folder holds a dev container definition.
   *
   * @param folder - The folder.
   * @returns `true` when `.devcontainer/devcontainer.json` exists in it.
   */
  public async hasDevContainer(folder: string): Promise<boolean> {
    return this.files.exists(FilePath.join(folder, DevContainer.FILE))
  }

  private async address(source: SoftwareSource, report: (message: Message) => void): Promise<CloneAddress> {
    const addresses: CloneAddress[] = Forks.addresses(source)
    for (const address of addresses.slice(0, -1)) {
      report(msg('checking SSH access…'))
      if (await this.sourceControl.reachable(address.url)) return address
    }
    const last: CloneAddress | undefined = addresses.at(-1)
    if (!last) throw new DomainError(msg('The source has no address to clone.'))
    return last
  }

  private static failure(url: string, error: unknown): DomainError {
    return new DomainError(GitFailures.message(GitRemotes.display(url), error), 'retryClone')
  }
}
