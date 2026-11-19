/**
 * The host's check of whether a software can be published.
 *
 * @module
 */
/** How serious a publish problem is: an error blocks publishing, a warning does not. */
export type ProblemLevel = 'error' | 'warning'

/** One problem the host found in the software before publishing it. */
export interface PublishProblem {
  /** The metadata field the problem is about. */
  readonly field: string
  /** The host's description of the problem. */
  readonly message: string
  /** How serious the problem is. */
  readonly level: ProblemLevel
}

/** The host's verdict on whether the software can be published. */
export interface PublishCheck {
  /** Whether the host would accept publishing. */
  readonly ok: boolean
  /** The problems found. */
  readonly problems: readonly PublishProblem[]
}

/** Rules on {@link PublishCheck} values. */
export class PublishChecks {
  /**
   * Picks the blocking problems of a check.
   * @param check - The check, or `null` when there is none.
   * @returns The problems of level `error`.
   */
  public static errors(check: PublishCheck | null): PublishProblem[] {
    return check?.problems.filter((problem: PublishProblem) => problem.level === 'error') ?? []
  }
}
