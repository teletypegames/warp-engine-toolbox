/**
 * Pull from upstream: a fork brought up to date with the software it was forked from.
 *
 * @module
 */
import { GitFailures } from '../model/git-failure.model'
import { GitRemotes } from '../model/git-remote.model'
import { DomainError, msg, type Message } from '../model/message.model'
import type { Project } from '../model/project.model'
import type { MergeOutcome, SourceControl, SourceControlFactory } from '../repository/source-control.repository'

/** What {@link UpstreamService.pull} did, with the branch it merged. */
export interface PullResult extends MergeOutcome {
  /** The upstream branch merged, such as `upstream/master`. */
  readonly ref: string
}

const UPSTREAM = 'upstream'

/** Fetches the `upstream` remote of a project and merges its default branch into the checked-out branch. */
export class UpstreamService {
  /**
   * Creates the service.
   *
   * @param sourceControl - Opens the project's git repository.
   */
  public constructor(private readonly sourceControl: SourceControlFactory) {}

  /**
   * Tells whether a project has an `upstream` remote, as a fork made by the toolbox has.
   *
   * @param project - The project.
   * @returns `true` when the remote exists.
   */
  public async hasUpstream(project: Project): Promise<boolean> {
    return (await this.sourceControl.at(project.folder).remoteUrl(UPSTREAM)) !== null
  }

  /**
   * Runs `git fetch upstream` and merges the upstream default branch. A conflict leaves the merge in progress, for the
   * editor's merge view.
   *
   * @param project - The project.
   * @param report - Called with each step, for the progress notification.
   * @returns What the merge did and which branch it merged.
   * @throws {@link "domain/model/message.model".DomainError} When there is no `upstream` remote, the working copy has
   *   changes, the fetch fails (with the remedy `pullUpstream`) or the default branch cannot be found.
   */
  public async pull(project: Project, report: (message: Message) => void): Promise<PullResult> {
    const git: SourceControl = this.sourceControl.at(project.folder)
    const url: string | null = await git.remoteUrl(UPSTREAM)
    if (!url) throw new DomainError(msg('{0} has no upstream remote: only a fork has one.', project.title))
    if (!(await git.isClean())) throw new DomainError(msg('{0} has uncommitted changes: commit or stash them before pulling from upstream.', project.title))
    report(msg('fetching {0}…', GitRemotes.display(url)))
    await git.fetch(UPSTREAM).catch((error: unknown) => { throw new DomainError(GitFailures.message(GitRemotes.display(url), error), 'pullUpstream') })
    const branch: string | null = await git.remoteHead(UPSTREAM)
    if (!branch) throw new DomainError(msg('The default branch of the upstream remote cannot be found: merge it with git by hand.'))
    const ref = `${UPSTREAM}/${branch}`
    report(msg('merging {0}…', ref))
    return { ...(await git.merge(ref)), ref }
  }
}
