/**
 * The host's CI pipelines and their runs.
 *
 * @module
 */
/** The CI pipeline the host keeps for a repository, as the admin API sends it. */
export interface Pipeline {
  /** The host's id of the pipeline. */
  readonly id: number
  /** The owner (user or organisation) of the repository. */
  readonly repoOwner: string
  /** The repository's name. */
  readonly repoName: string
  /** The platform the pipeline builds for. */
  readonly platform: string
  /** Whether the host builds on pushes to the repository. */
  readonly active: boolean
  /** The id of the catalog software the pipeline publishes, or `null` when not linked yet. */
  readonly softwareId: number | null
}

/** One run (build) of a {@link Pipeline}. */
export interface PipelineRun {
  /** The run's number within the pipeline. */
  readonly number: number
  /** The CI status, such as `pending`, `running`, `success` or `failure`. */
  readonly status: string
  /** The branch that was built, if any. */
  readonly branch: string | null
  /** The commit message of the built commit. */
  readonly message: string | null
  /** When the run was created, as an ISO 8601 timestamp. */
  readonly createdAt: string | null
  /** The link to the run in the CI's web interface. */
  readonly url: string | null
  /** The SHA of the built commit. */
  readonly commit: string | null
  /** The event that started the run, such as `push` or `tag`. */
  readonly event: string | null
  /** The git ref that was built, such as `refs/tags/v1.0.0`. */
  readonly ref: string | null
}

const RUNNING: ReadonlySet<string> = new Set(['pending', 'running', 'created', 'blocked', 'started'])

/** Rules on {@link PipelineRun} values. */
export class PipelineRuns {
  /**
   * Tells whether a run has not finished yet.
   * @param run - The run, or `null` when there is none.
   * @returns `true` while the status is pending, created, blocked, started or running.
   */
  public static isRunning(run: PipelineRun | null): boolean {
    return run !== null && RUNNING.has(run.status)
  }

  /**
   * Tells whether a run finished successfully.
   * @param run - The run.
   * @returns `true` when the status is `success`.
   */
  public static isSuccess(run: PipelineRun): boolean {
    return run.status === 'success'
  }
}
