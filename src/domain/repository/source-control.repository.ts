/**
 * Port to git.
 *
 * @module
 */
import type { Commit } from '../model/commit.model'
import type { GitRemote } from '../model/git-remote.model'

/**
 * Port to the git repository of one folder.
 *
 * The queries resolve to `null`, `false` or empty when git cannot answer; the members that change
 * the repository (`init`, `addAll`, `commit`, `tag`, `push`, `setRemote`, `setRemoteUrl`) and
 * {@link SourceControl.isClean} reject with an `Error` carrying git's message when git fails.
 */
export interface SourceControl {
  /**
   * Tells whether the folder is inside a git work tree.
   *
   * @returns `true` inside a work tree.
   */
  isRepository(): Promise<boolean>
  /**
   * Reads the commit `HEAD` points to.
   *
   * @returns The full commit hash, or `null` when there is none yet or no repository.
   */
  head(): Promise<string | null>
  /**
   * Reads the current branch.
   *
   * @returns The branch name (`HEAD` when detached), or `null` when git cannot tell.
   */
  branch(): Promise<string | null>
  /**
   * Reads the default branch of `origin` from the remote's `HEAD`.
   *
   * @returns The branch name without `origin/`, or `null` when unknown.
   */
  defaultBranch(): Promise<string | null>
  /**
   * Tells whether the work tree has no changes, untracked files included.
   *
   * @returns `true` when there is nothing to commit.
   */
  isClean(): Promise<boolean>
  /**
   * Reads the URL of `origin`.
   *
   * @returns The URL, or `null` when there is no `origin`.
   */
  remote(): Promise<string | null>
  /**
   * Reads the URL of a remote.
   *
   * @param name - The remote name.
   * @returns The URL, or `null` when there is no such remote.
   */
  remoteUrl(name: string): Promise<string | null>
  /**
   * Lists the remotes with their URLs.
   *
   * @returns The remotes; empty when there are none.
   */
  remotes(): Promise<GitRemote[]>
  /**
   * Points a remote at a URL, adding the remote when it does not exist yet.
   *
   * @param name - The remote name.
   * @param url - The new URL.
   */
  setRemoteUrl(name: string, url: string): Promise<void>
  /**
   * Tells whether the repository has at least one commit.
   *
   * @returns `true` when `HEAD` resolves.
   */
  hasCommits(): Promise<boolean>
  /** Fetches the tags of `origin` quietly; a failure (offline, no remote) is ignored. */
  fetchTags(): Promise<void>
  /**
   * Finds the newest version tag (`v` followed by a digit) reachable from `HEAD`.
   *
   * @returns The tag, or `null` when there is none.
   */
  lastTag(): Promise<string | null>
  /**
   * Lists the commits after a ref up to `HEAD`, newest first.
   *
   * @param ref - The ref to start after, or `null` for the whole history.
   * @returns The commits with hash and subject; empty when git cannot list them.
   */
  commitsSince(ref: string | null): Promise<Commit[]>
  /**
   * Creates the repository.
   *
   * @param branch - The name of the initial branch.
   */
  init(branch: string): Promise<void>
  /** Stages every change, deletions and untracked files included. */
  addAll(): Promise<void>
  /**
   * Commits the staged changes.
   *
   * @param message - The commit message.
   */
  commit(message: string): Promise<void>
  /**
   * Points `origin` at a URL, adding it when missing.
   *
   * @param url - The new URL.
   */
  setRemote(url: string): Promise<void>
  /**
   * Creates an annotated tag on `HEAD`.
   *
   * @param name - The tag name, e.g. `v1.2.0`.
   * @param message - The tag message.
   */
  tag(name: string, message: string): Promise<void>
  /**
   * Runs `git push` with the given arguments.
   *
   * @param args - The arguments after `push`, e.g. `["origin", "main", "v1.2.0"]`.
   */
  push(args: readonly string[]): Promise<void>
  /**
   * Renames a remote (`git remote rename`), with its remote-tracking branches.
   *
   * @param from - The current name.
   * @param to - The new name.
   */
  renameRemote(from: string, to: string): Promise<void>
  /**
   * Fetches a remote (`git fetch`).
   *
   * @param remote - The remote name.
   */
  fetch(remote: string): Promise<void>
  /**
   * Reads the default branch of a remote, asking the remote when it is not known locally.
   *
   * @param remote - The remote name.
   * @returns The branch name without the remote prefix, or `null` when it cannot be found.
   */
  remoteHead(remote: string): Promise<string | null>
  /**
   * Merges a reference into the checked-out branch (`git merge --no-edit`).
   *
   * @param ref - The reference, such as `upstream/master`.
   * @returns What happened; a conflict leaves the merge in progress for the user.
   */
  merge(ref: string): Promise<MergeOutcome>
}

/** What a merge did: nothing new, merged (fast-forward or with a merge commit), or stopped on conflicts. */
export interface MergeOutcome {
  /** `upToDate`, `merged` or `conflict`. */
  readonly state: 'upToDate' | 'merged' | 'conflict'
  /** The files left with conflicts; empty unless `conflict`. */
  readonly conflicts: readonly string[]
}

/** What {@link SourceControlFactory.clone} clones and where. */
export interface CloneRequest {
  /** The address to clone. */
  readonly url: string
  /** The folder to create; it must not exist. */
  readonly folder: string
  /** The branch or tag to check out, or `null` for the default branch. */
  readonly ref: string | null
  /** `true` clones without the blobs of the history (`--filter=blob:none`); they are fetched when needed. */
  readonly partial: boolean
}

/** Creates {@link SourceControl} ports and reads the global git identity. */
export interface SourceControlFactory {
  /**
   * Gives the git port of a folder; runs nothing yet.
   *
   * @param folder - The absolute folder.
   * @returns The port for that folder.
   */
  at(folder: string): SourceControl
  /**
   * Reads the configured `user.name`.
   *
   * @returns The name; empty when none is set.
   */
  userName(): Promise<string>
  /**
   * Clones a repository into a new folder (`git clone`), never asking for credentials.
   *
   * @param request - The address, the folder, the branch and whether the clone is partial.
   * @throws `Error` with git's standard error when the clone fails.
   */
  clone(request: CloneRequest): Promise<void>
  /**
   * Tells whether a remote answers without asking anything (`git ls-remote` with SSH in batch mode and no prompts).
   *
   * @param url - The address.
   * @returns `true` when git lists the remote's references.
   */
  reachable(url: string): Promise<boolean>
}
