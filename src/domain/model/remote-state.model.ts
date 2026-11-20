/**
 * What the host knows about a project, combined with its local git position.
 *
 * @module
 */
import { Releases, type Release, type Software } from './catalog.model'
import { PipelineRuns, type Pipeline, type PipelineRun } from './pipeline.model'
import type { Project } from './project.model'

/** Where the local git checkout of a project stands. */
export interface GitPosition {
  /** The SHA of the checked-out commit. */
  readonly head: string | null
  /** The current branch, or `null` when detached. */
  readonly branch: string | null
  /** The repository's default branch, if known. */
  readonly defaultBranch: string | null
}

/** What the host knows about a project, polled for the views and the status bar. */
export interface RemoteState extends GitPosition {
  /** The project the state is about. */
  readonly project: Project
  /** Whether there is a session for the host. */
  readonly signedIn: boolean
  /** The project's software in the catalog, or `null` when not published yet. */
  readonly software: Software | null
  /** The project's CI pipeline, or `null` when not set up. */
  readonly pipeline: Pipeline | null
  /** The pipeline's recent runs, newest first. */
  readonly runs: readonly PipelineRun[]
  /** The run that built the checked-out commit, if any. */
  readonly headRun: PipelineRun | null
  /** The software's releases. */
  readonly releases: readonly Release[]
  /** The dev build of the current side branch, if any. */
  readonly branchBuild: Release | null
  /** The message of the error that stopped the poll, or `null`. */
  readonly error: string | null
  /** Whether the host refused the session. */
  readonly unauthorized: boolean
}

/** What the end of a run of `HEAD` comes to, for the notification that announces it. */
export interface RunOutcome {
  /**
   * `failed` when the run did not succeed, `published` when it published a listed release, `passed` when it published
   * nothing, `devBuild` when it built a branch's development build (which the branch notice announces).
   */
  readonly kind: 'failed' | 'published' | 'passed' | 'devBuild'
  /** The run. */
  readonly run: PipelineRun
  /** The release it published, or `null`. */
  readonly release: Release | null
}

/** Rules on {@link RemoteState} values. */
export class RemoteStates {
  /**
   * Builds the state with nothing known from the host yet.
   * @param project - The project.
   * @param position - The local git position.
   * @param signedIn - Whether there is a session for the host.
   * @returns A state with no software, pipeline, runs or releases and no error.
   */
  public static empty(project: Project, position: GitPosition, signedIn: boolean): RemoteState {
    return { project, ...position, signedIn, software: null, pipeline: null, runs: [], headRun: null, releases: [], branchBuild: null, error: null, unauthorized: false }
  }

  /**
   * Picks the run to show for a project.
   * @param state - The state.
   * @returns The run of the checked-out commit, else the newest run, or `null`.
   */
  public static latestRun(state: RemoteState): PipelineRun | null {
    return state.headRun ?? state.runs[0] ?? null
  }

  /**
   * Decides what the ended run of `HEAD` comes to.
   * @param state - The state loaded after the run.
   * @returns The outcome, or `null` without a run of `HEAD`.
   */
  public static runOutcome(state: RemoteState): RunOutcome | null {
    const run: PipelineRun | null = state.headRun
    if (!run) return null
    if (!PipelineRuns.isSuccess(run)) return { kind: 'failed', run, release: null }
    const release: Release | null = RemoteStates.releaseOf(state, run)
    if (!release) return { kind: 'passed', run, release }
    return { kind: Releases.isDev(release) ? 'devBuild' : 'published', run, release }
  }

  /**
   * Finds the release a finished run published.
   * @param state - The state loaded after the run.
   * @param run - The run.
   * @returns The release of the run's tag (`refs/tags/v1.2.0` → `1.2.0`), else a listed release, else a development build
   * built from the run's commit; `null` when the run published none.
   */
  public static releaseOf(state: RemoteState, run: PipelineRun): Release | null {
    const tag: string | undefined = /^refs\/tags\/v?(.+)$/.exec(run.ref ?? '')?.[1]
    const tagged: Release | undefined = state.releases.find((release: Release) => tag !== undefined && release.version === tag)
    const built: Release[] = state.releases.filter((release: Release) => run.commit !== null && release.commitSha === run.commit)
    return tagged ?? built.find((release: Release) => !Releases.isDev(release)) ?? built[0] ?? null
  }

  /**
   * Sums up what of a state the Health view shows: the catalog part, the latest run and the authorization.
   * @param state - The state, or `null` without a project.
   * @returns A key that changes with any of those; empty without a session.
   */
  public static healthKey(state: RemoteState | null): string {
    if (!state?.signedIn) return ''
    const run: PipelineRun | null = RemoteStates.latestRun(state)
    const runKey: string = run ? `${String(run.number)}:${run.status}` : '-'
    return [state.project.folder, RemoteStates.catalogKey(state), runKey, String(state.unauthorized)].join('|')
  }

  /**
   * Sums up what of a state the catalog also shows: the software, its pipeline and its releases with their assets.
   * Two states with the same key need no redraw of the catalog.
   * @param state - The state, or `null` without a project.
   * @returns A key that changes when a software appears or changes, a pipeline is linked, or a release is added, updated or removed.
   */
  public static catalogKey(state: RemoteState | null): string {
    if (!state?.signedIn || state.error) return ''
    const software: string = state.software ? `${String(state.software.id)}:${state.software.status ?? ''}:${state.software.title}` : '-'
    const releases: string[] = state.releases.map((release: Release) => `${String(release.id)}@${release.updatedAt ?? release.createdAt ?? ''}#${String(release.assets.length)}`)
    return [software, String(state.pipeline?.id ?? '-'), ...releases].join('|')
  }

  /**
   * Tells whether the checkout is on a branch other than the default one.
   * @param state - The state.
   * @returns `true` when both branches are known and differ.
   */
  public static isOnSideBranch(state: RemoteState): boolean {
    return state.branch !== null && state.defaultBranch !== null && state.branch !== state.defaultBranch
  }
}
