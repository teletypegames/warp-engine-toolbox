/**
 * A git commit, as the changelog uses it.
 *
 * @module
 */
/** A git commit, as far as the changelog needs it. */
export interface Commit {
  /** The full commit hash. */
  readonly sha: string
  /** The first line of the commit message. */
  readonly subject: string
}
