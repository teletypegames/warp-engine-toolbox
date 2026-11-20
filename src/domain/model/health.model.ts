/**
 * What is set up and what is not: the checks of the Health view, decided from facts gathered elsewhere.
 *
 * @module
 */
import type { Principal } from './catalog.model'
import type { Host } from './host.model'
import type { WellKnown } from './local-engine.model'
import { msg, type Message, type Remedy } from './message.model'
import { PipelineRuns, type PipelineRun } from './pipeline.model'
import type { Project } from './project.model'
import type { PublishCheck, PublishProblem } from './publish-check.model'
import { RemoteStates, type RemoteState } from './remote-state.model'
import { Servers, type ServerContainer, type ServerRole } from './server.model'

/** How a check came out, from the best to the worst; `info` is neither good nor bad (nothing to do). */
export type HealthStatus = 'ok' | 'info' | 'warning' | 'error'

/** One line of the Health view. */
export interface HealthCheck {
  /** What was checked and how it stands. */
  readonly title: Message
  /** How it came out. */
  readonly status: HealthStatus
  /** More about it, or `null`. */
  readonly detail: Message | null
  /** The step that fixes it, or `null` when there is nothing to do or nothing the toolbox can do. */
  readonly remedy: Remedy | null
  /** A page that shows more (a run's log, the admin page), or `null`. */
  readonly url: string | null
}

/** A group of checks: the host, the local engine, the project. */
export interface HealthSection {
  /** The group's title. */
  readonly title: Message
  /** Its checks, in order. */
  readonly checks: readonly HealthCheck[]
}

/** What is known about the current host. */
export interface HostFacts {
  /** The current host, or `null` when none is set. */
  readonly host: Host | null
  /** What the host says about itself, or `null` when it does not answer. */
  readonly info: WellKnown | null
  /** Whether a session is stored for the host. */
  readonly signedIn: boolean
  /** Who the session's token belongs to, or `null` when it could not be asked. */
  readonly principal: Principal | null
  /** Whether the host refused the session's token. */
  readonly refused: boolean
}

/** What is known about the WarpEngine containers on this machine. */
export interface LocalFacts {
  /** Whether the current host is the local engine. */
  readonly isCurrentHost: boolean
  /** The containers, or `null` when Docker could not be asked. */
  readonly containers: readonly ServerContainer[] | null
}

/** What is known about the current project. */
export interface ProjectFacts {
  /** The current project, or `null` when the workspace has none. */
  readonly project: Project | null
  /** The host's publish check of its metadata, or `null` when it was not checked. */
  readonly check: PublishCheck | null
  /** Its remote state, or `null` before it was loaded. */
  readonly state: RemoteState | null
  /** Whether the current host is the local engine (the local CI then stands for Connect). */
  readonly local: boolean
  /** The software's admin page, or `null`. */
  readonly adminUrl: string | null
}

const RANK: readonly HealthStatus[] = ['ok', 'info', 'warning', 'error']
const CI_ROLES: readonly ServerRole[] = ['git', 'ci', 'agent']

/** Decides the checks of the Health view from facts. */
export class Health {
  /**
   * Picks the worst status of some checks.
   * @param checks - The checks.
   * @returns The worst status; `ok` for none.
   */
  public static worst(checks: readonly HealthCheck[]): HealthStatus {
    return checks.reduce<HealthStatus>((worst: HealthStatus, check: HealthCheck) => RANK.indexOf(check.status) > RANK.indexOf(worst) ? check.status : worst, 'ok')
  }

  /**
   * Checks the host: set, answering, signed in, the token taken.
   * @param facts - What is known about the host.
   * @returns The section.
   */
  public static host(facts: HostFacts): HealthSection {
    const title: Message = msg('Host')
    if (!facts.host) return { title, checks: [Health.check(msg('No host is set'), 'error', { remedy: 'selectHost' })] }
    const answer: HealthCheck = facts.info
      ? Health.check(msg('{0} answers', facts.host.name), 'ok', { detail: msg('WarpEngine {0} ({1})', facts.info.version, facts.info.profile), url: facts.host.url })
      : Health.check(msg('{0} does not answer', facts.host.name), 'error', { detail: msg('{0}', facts.host.url) })
    return { title, checks: [answer, Health.session(facts)] }
  }

  /**
   * Checks the local engine and its CI from its containers.
   * @param facts - What is known about the containers.
   * @returns The section, or `null` when there is no local engine and it is not the host either.
   */
  public static local(facts: LocalFacts): HealthSection | null {
    const title: Message = msg('Local engine')
    if (facts.containers === null) {
      return facts.isCurrentHost ? { title, checks: [Health.check(msg('Docker does not answer'), 'error', { detail: msg('The local engine runs in Docker: start Docker Desktop (or the Docker service).') })] } : null
    }
    const engine: ServerContainer | undefined = facts.containers.find((container: ServerContainer) => Servers.role(container) === 'engine')
    if (!engine && !facts.isCurrentHost) return null
    return { title, checks: [Health.engine(engine), Health.ci(facts.containers)] }
  }

  /**
   * Checks the project: found, its platform, its metadata, and on the host its catalog entry, pipeline and last run.
   * @param facts - What is known about the project.
   * @returns The section.
   */
  public static project(facts: ProjectFacts): HealthSection {
    const project: Project | null = facts.project
    if (!project) return { title: msg('Project'), checks: [Health.check(msg('No WarpEngine project in this workspace'), 'info', { remedy: 'addToProject' })] }
    const checks: HealthCheck[] = [Health.platform(project), Health.metadata(project, facts.check)]
    const state: RemoteState | null = facts.state
    if (state?.signedIn && !state.error) checks.push(...Health.remote(state, facts))
    return { title: msg('Project {0}', project.title), checks }
  }

  private static session(facts: HostFacts): HealthCheck {
    if (!facts.signedIn) return Health.check(msg('Not signed in'), 'warning', { remedy: 'signIn' })
    if (facts.refused) return Health.check(msg('The host refused the stored token'), 'error', { remedy: 'reauthorize' })
    const label: string = facts.principal?.label ?? '?'
    return Health.check(msg('Signed in as {0}', label), 'ok', { detail: facts.principal ? msg('{0}', facts.principal.scopes.join(', ')) : null })
  }

  private static engine(engine: ServerContainer | undefined): HealthCheck {
    if (!engine) return Health.check(msg('The local engine is not installed'), 'error', { remedy: 'installLocalEngine' })
    if (engine.state !== 'running') return Health.check(msg('The local engine is stopped'), 'error', { detail: msg('{0}', engine.status), remedy: 'installLocalEngine' })
    return Health.check(msg('The local engine runs'), 'ok', { detail: msg('{0}', engine.status), url: Servers.url(engine) })
  }

  private static ci(containers: readonly ServerContainer[]): HealthCheck {
    const parts: ServerContainer[] = containers.filter((container: ServerContainer) => CI_ROLES.includes(Servers.role(container)))
    if (parts.length === 0) return Health.check(msg('The local CI is not installed'), 'info', { detail: msg('Run the installer again and answer yes to "Local CI" to build on this machine.'), remedy: 'installLocalEngine' })
    const stopped: string[] = parts.filter((container: ServerContainer) => container.state !== 'running').map((container: ServerContainer) => container.name)
    if (stopped.length > 0) return Health.check(msg('The local CI is partly stopped'), 'error', { detail: msg('{0}', stopped.join(', ')) })
    return Health.check(msg('The local CI runs'), 'ok', { detail: msg('{0}', parts.map((container: ServerContainer) => container.name).join(', ')) })
  }

  private static platform(project: Project): HealthCheck {
    if (!project.platform) return Health.check(msg('The host does not know the platform {0}', project.platformName), 'error', {})
    return Health.check(msg('Platform: {0}', project.platform.label), 'ok', { url: project.platform.docsUrl ?? null })
  }

  private static metadata(project: Project, check: PublishCheck | null): HealthCheck {
    if (!project.metadataPath) return Health.check(msg('No metadata file'), 'warning', { detail: msg('The catalog entry is made from it.') })
    if (!check) return Health.check(msg('Metadata not checked'), 'info', { remedy: 'editMetadata' })
    const errors: number = check.problems.filter((problem: PublishProblem) => problem.level === 'error').length
    const warnings: number = check.problems.length - errors
    if (errors > 0) return Health.check(msg('{0} metadata problems would stop a publish', errors), 'error', { detail: Health.fields(check), remedy: 'editMetadata' })
    if (warnings > 0) return Health.check(msg('Metadata publishes, with {0} warnings', warnings), 'warning', { detail: Health.fields(check), remedy: 'editMetadata' })
    return Health.check(msg('Metadata ready to publish'), 'ok', {})
  }

  private static remote(state: RemoteState, facts: ProjectFacts): HealthCheck[] {
    const setup: Remedy = facts.local ? 'setupLocalCi' : 'connect'
    if (!state.software) return [Health.check(msg('Not on the host yet'), 'warning', { remedy: setup })]
    const entry: HealthCheck = Health.check(msg('In the catalog: {0}', state.software.title), 'ok', { detail: msg('{0}', state.software.status ?? '—'), url: facts.adminUrl })
    if (!state.pipeline) return [entry, Health.check(msg('No pipeline is linked'), 'warning', { remedy: facts.local ? setup : null, url: facts.local ? null : facts.adminUrl })]
    const pipeline: HealthCheck = state.pipeline.active
      ? Health.check(msg('Pipeline: {0}/{1}', state.pipeline.repoOwner, state.pipeline.repoName), 'ok', {})
      : Health.check(msg('The pipeline {0}/{1} is inactive', state.pipeline.repoOwner, state.pipeline.repoName), 'warning', { url: facts.adminUrl })
    return [entry, pipeline, Health.run(RemoteStates.latestRun(state))]
  }

  private static run(run: PipelineRun | null): HealthCheck {
    if (!run) return Health.check(msg('No run yet'), 'info', { detail: msg('Push to build it.') })
    const detail: Message = msg('{0} {1}', run.branch ?? '', run.commit?.slice(0, 7) ?? '')
    if (PipelineRuns.isRunning(run)) return Health.check(msg('Run #{0} is {1}', run.number, run.status), 'info', { detail, url: run.url })
    if (PipelineRuns.isSuccess(run)) return Health.check(msg('Last run #{0} passed', run.number), 'ok', { detail, url: run.url })
    return Health.check(msg('Last run #{0} ended: {1}', run.number, run.status), 'error', { detail, url: run.url })
  }

  private static fields(check: PublishCheck): Message {
    return msg('{0}', check.problems.map((problem: PublishProblem) => problem.field).join(', '))
  }

  private static check(title: Message, status: HealthStatus, extra: { readonly detail?: Message | null; readonly remedy?: Remedy | null; readonly url?: string | null }): HealthCheck {
    return { title, status, detail: extra.detail ?? null, remedy: extra.remedy ?? null, url: extra.url ?? null }
  }
}
