/**
 * What the host knows about a project, combined with its local git position.
 *
 * @module
 */
import type { Release, Software } from './catalog.model'
import type { Pipeline, PipelineRun } from './pipeline.model'
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
