import type { Release, Software } from './catalog.model'
import type { Pipeline, PipelineRun } from './pipeline.model'
import type { Project } from './project.model'

export interface GitPosition {
  readonly head: string | null
  readonly branch: string | null
  readonly defaultBranch: string | null
}

export interface RemoteState extends GitPosition {
  readonly project: Project
  readonly signedIn: boolean
  readonly software: Software | null
  readonly pipeline: Pipeline | null
  readonly runs: readonly PipelineRun[]
  readonly headRun: PipelineRun | null
  readonly releases: readonly Release[]
  readonly branchBuild: Release | null
  readonly error: string | null
}

export function emptyRemoteState(project: Project, position: GitPosition, signedIn: boolean): RemoteState {
  return { project, ...position, signedIn, software: null, pipeline: null, runs: [], headRun: null, releases: [], branchBuild: null, error: null }
}

export function latestRun(state: RemoteState): PipelineRun | null {
  return state.headRun ?? state.runs[0] ?? null
}

export function isOnSideBranch(state: RemoteState): boolean {
  return state.branch !== null && state.defaultBranch !== null && state.branch !== state.defaultBranch
}
