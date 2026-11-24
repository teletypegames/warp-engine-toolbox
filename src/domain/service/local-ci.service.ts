/**
 * Building a project on the CI of the local engine.
 *
 * @module
 */
import type { ScaffoldResult, Software } from '../model/catalog.model'
import { LocalCi, type LocalCiSetup, type LocalComponent, type LocalOperation, type OperationStep } from '../model/local-ci.model'
import type { LocalEngine } from '../model/local-engine.model'
import { DomainError, msg, type Message } from '../model/message.model'
import type { Project } from '../model/project.model'
import type { RemoteState } from '../model/remote-state.model'
import type { LocalComponentRepository } from '../repository/local-component.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { AdminRepositories, WarpEngineGateway } from '../repository/warp-engine.gateway'
import type { LocalEngineService } from './local-engine.service'

/** What {@link LocalCiService} works with. */
export interface LocalCiDependencies {
  /** Creates the admin repositories of the local engine. */
  readonly gateway: WarpEngineGateway
  /** Finds the local engine and its token. */
  readonly local: LocalEngineService
  /** Opens the git repository of the project. */
  readonly sourceControl: SourceControlFactory
  /** Waits between two polls; a timer by default, replaced in the tests. */
  readonly wait?: (ms: number) => Promise<void>
}

/** Receives each progress step of a long flow, for the progress notification. */
export type Report = (message: Message) => void

const POLL_MS = 2000
const LIMIT_MS = 30 * 60 * 1000
const FIRST_BRANCH = 'master'

/** Connects a project to the Git server and CI that run beside the local WarpEngine, and follows the engine's long operations. */
export class LocalCiService {
  private readonly wait: (ms: number) => Promise<void>

  /**
   * Creates the service.
   *
   * @param deps - The gateway, the local engine service, git and the wait function.
   */
  public constructor(private readonly deps: LocalCiDependencies) {
    this.wait = deps.wait ?? (async (ms: number): Promise<void> => new Promise<void>((done: () => void) => { setTimeout(done, ms) }))
  }

  /**
   * Tells whether a local engine was discovered.
   *
   * @returns `true` when one is running.
   */
  public available(): boolean {
    return this.deps.local.current() !== null
  }

  /**
   * Tells whether the local engine's Git server and CI are up; asks the engine.
   *
   * @returns `true` when they are ready; `false` without a local engine or when it cannot be asked.
   */
  public async ready(): Promise<boolean> {
    if (!this.available()) return false
    return LocalCi.ready(await this.components().catch((): LocalComponent[] => []))
  }

  /**
   * Tells whether a project on the local engine still lacks its CI: signed in, no error, the current host is the local engine, and no pipeline yet.
   *
   * @param state - The remote state of the project, or `null`.
   * @returns `true` when the local CI should be set up.
   */
  public needsSetUp(state: RemoteState | null): boolean {
    if (!state?.signedIn || state.error !== null || !this.deps.local.isCurrentHost()) return false
    return state.pipeline === null
  }

  /**
   * Tells whether to offer setting up the local CI for a project: it needs it, the user has not skipped it, and the components are ready.
   *
   * @param state - The remote state of the project.
   * @param skipped - The project names the user declined the offer for.
   * @returns `true` when the offer should be shown.
   */
  public async offerable(state: RemoteState, skipped: readonly string[]): Promise<boolean> {
    if (!this.needsSetUp(state) || skipped.includes(state.project.name)) return false
    return this.ready()
  }

  /**
   * Lists the local engine's components and their state.
   *
   * @returns The components; empty without a local engine.
   * @throws {@link "domain/model/message.model".DomainError} When the local engine's token is not found.
   */
  public async components(): Promise<LocalComponent[]> {
    if (!this.available()) return []
    return (await this.repository()).components()
  }

  /**
   * Polls a local engine operation every two seconds until it finishes, reporting each new step.
   *
   * @param started - The operation as it was started.
   * @param report - Receives the steps.
   * @returns The finished operation.
   * @throws {@link "domain/model/message.model".DomainError} When the operation fails, takes longer than 30 minutes, or no local engine runs.
   */
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

  /**
   * Sets up the local CI for a project: finds or scaffolds its software on the local engine, has
   * the engine create the repository and pipeline, then sets the local remote, commits and pushes,
   * which starts the first build.
   *
   * @param project - The project.
   * @param report - Receives the progress steps.
   * @returns The remote name and push URL the engine gave.
   * @throws {@link "domain/model/message.model".DomainError} When no local engine runs, its CI is not running, the operation fails or no push address comes back.
   */
  public async setUp(project: Project, report: Report): Promise<LocalCiSetup> {
    const admin: AdminRepositories = await this.admin()
    if (!LocalCi.ready(await admin.local.components())) {
      throw new DomainError(msg('The local CI is not running: run the local engine\'s installer again and answer yes to "Local CI" (or --ci on).'), 'installLocalEngine')
    }
    report(msg('finding {0} in the local catalog…', project.name))
    const software: Software = (await admin.catalog.softwareByName(project.name)) ?? (await this.scaffold(admin, project)).software
    report(msg('connecting {0} to the local git server and CI…', project.name))
    const done: LocalOperation = await this.follow(await admin.local.setUpCi(software.id), report)
    const setup: LocalCiSetup | null = LocalCi.setupOf(done)
    if (!setup) throw new DomainError(msg('The local engine sent no push address.'))
    await this.push(project, setup, report)
    return setup
  }

  private async scaffold(admin: AdminRepositories, project: Project): Promise<ScaffoldResult> {
    const app: string | undefined = project.marker.options['app']
    return admin.catalog.scaffold({
      name: project.name, title: project.title, platform: project.platformName,
      category: project.metadata.trimmed('category'), description: project.metadata.trimmed('desc') ?? project.title,
      ...(app ? { app } : {})
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
    if (!local) throw new DomainError(msg('No local WarpEngine is running: install one first ("WarpEngine: Install Local Engine").'), 'installLocalEngine')
    return this.deps.gateway.admin(local.url, await this.deps.local.token())
  }

  private async repository(): Promise<LocalComponentRepository> {
    return (await this.admin()).local
  }
}
