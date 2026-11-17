import type { ScaffoldResult } from '../model/catalog.model'
import { DomainError, msg, type Message } from '../model/message.model'
import { MetadataDocument } from '../model/metadata-document.model'
import type { Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { ConnectionService } from './connection.service'

export interface RemoteOption {
  readonly label: string
  readonly url: string
}

export interface AttachInput {
  readonly project: Project
  readonly scaffold: ScaffoldResult
  readonly remote: string | null
  readonly report: (message: Message) => void
}

const FIRST_BRANCH = 'master'

export class ConnectService {
  public constructor(
    private readonly connection: ConnectionService,
    private readonly sourceControl: SourceControlFactory,
    private readonly files: FileSystemRepository
  ) {}

  public async signIn(): Promise<boolean> {
    return (await this.connection.admin(true)) !== null
  }

  public async existingRemote(project: Project): Promise<string | null> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    return await git.isRepository() ? git.remote() : null
  }

  public async scaffold(project: Project): Promise<ScaffoldResult> {
    const admin = await this.connection.admin(true)
    if (!admin) throw new DomainError(msg('Sign in first.'))
    const title: string = project.title
    return admin.catalog.scaffold({
      name: project.name, title, platform: project.platformName,
      category: project.metadata.trimmed('category'), description: project.metadata.trimmed('desc') ?? title
    })
  }

  public remoteOptions(scaffold: ScaffoldResult): RemoteOption[] {
    const options: RemoteOption[] = []
    if (scaffold.repository.sshUrl) options.push({ label: 'SSH', url: scaffold.repository.sshUrl })
    if (scaffold.repository.cloneUrl) options.push({ label: 'HTTPS', url: scaffold.repository.cloneUrl })
    return options
  }

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
