import type { ScaffoldResult, Software } from '../model/catalog.model'
import { LocalCi, type LocalCiSetup, type LocalComponent, type LocalCredentials, type LocalOperation, type OperationStep } from '../model/local-ci.model'
import type { LocalEngine } from '../model/local-engine.model'
import { DomainError, msg, type Message } from '../model/message.model'
import type { Project } from '../model/project.model'
import type { LocalComponentRepository } from '../repository/local-component.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { AdminRepositories, WarpEngineGateway } from '../repository/warp-engine.gateway'
import type { LocalEngineService } from './local-engine.service'

export interface LocalCiDependencies {
  readonly gateway: WarpEngineGateway
  readonly local: LocalEngineService
  readonly sourceControl: SourceControlFactory
  readonly wait?: (ms: number) => Promise<void>
}

export type Report = (message: Message) => void

const POLL_MS = 2000
const LIMIT_MS = 30 * 60 * 1000
const FIRST_BRANCH = 'master'

export class LocalCiService {
  private readonly wait: (ms: number) => Promise<void>

  public constructor(private readonly deps: LocalCiDependencies) {
    this.wait = deps.wait ?? (async (ms: number): Promise<void> => new Promise<void>((done: () => void) => { setTimeout(done, ms) }))
  }

  public available(): boolean {
    return this.deps.local.current() !== null
  }

  public async components(): Promise<LocalComponent[]> {
    if (!this.available()) return []
    return (await this.repository()).components()
  }

  public async run(action: 'enable' | 'disable' | 'remove' | 'purge', key: string, report: Report): Promise<LocalOperation> {
    const repository: LocalComponentRepository = await this.repository()
    const started: LocalOperation = action === 'enable' ? await repository.enable(key)
      : action === 'disable' ? await repository.disable(key) : await repository.remove(key, action === 'purge')
    return this.follow(started, report)
  }

  public async credentials(key: string): Promise<LocalCredentials> {
    return (await this.repository()).credentials(key)
  }

  public async follow(started: LocalOperation, report: Report): Promise<LocalOperation> {
    const repository: LocalComponentRepository = await this.repository()
    const deadline: number = Date.now() + LIMIT_MS
    let operation: LocalOperation = started
    let shown = 0
    for (;;) {
      operation.steps.slice(shown).forEach((step: OperationStep) => { report(msg('{0}', step.text)) })
      shown = operation.steps.length
      if (LocalCi.finished(operation)) break
      if (Date.now() > deadline) throw new DomainError(msg('The local engine is still working on it; look again later.'))
      await this.wait(POLL_MS)
      operation = await repository.operation(operation.id)
    }
    if (operation.state === 'failed') throw new DomainError(msg('The local engine could not do it: {0}', operation.error ?? '?'))
    return operation
  }

  public async setUp(project: Project, report: Report): Promise<LocalCiSetup> {
    const admin: AdminRepositories = await this.admin()
    report(msg('finding {0} in the local catalog…', project.name))
    const software: Software = (await admin.catalog.softwareByName(project.name)) ?? (await this.scaffold(admin, project)).software
    report(msg('starting the git server and the CI, and connecting {0}…', project.name))
    const done: LocalOperation = await this.follow(await admin.local.setUpCi(software.id), report)
    const setup: LocalCiSetup | null = LocalCi.setupOf(done)
    if (!setup) throw new DomainError(msg('The local engine sent no push address.'))
    await this.push(project, setup, report)
    return setup
  }

  private async scaffold(admin: AdminRepositories, project: Project): Promise<ScaffoldResult> {
    return admin.catalog.scaffold({
      name: project.name, title: project.title, platform: project.platformName,
      category: project.metadata.trimmed('category'), description: project.metadata.trimmed('desc') ?? project.title
    })
  }

  private async push(project: Project, setup: LocalCiSetup, report: Report): Promise<void> {
    const git: SourceControl = this.deps.sourceControl.at(project.folder)
    if (!(await git.isRepository())) await git.init(FIRST_BRANCH)
    await git.setRemoteUrl(setup.remoteName, setup.pushUrl)
    await git.addAll()
    if (!(await git.isClean()) || !(await git.hasCommits())) await git.commit(`Start ${project.title} on the local CI`)
    report(msg('pushing to {0}: the first build starts…', setup.remoteName))
    await git.push(['-u', setup.remoteName, (await git.branch()) ?? FIRST_BRANCH])
  }

  private async admin(): Promise<AdminRepositories> {
    const local: LocalEngine | null = this.deps.local.current()
    if (!local) throw new DomainError(msg('No local WarpEngine is running: install one first ("WarpEngine: Install Local Engine").'))
    return this.deps.gateway.admin(local.url, await this.deps.local.token())
  }

  private async repository(): Promise<LocalComponentRepository> {
    return (await this.admin()).local
  }
}
