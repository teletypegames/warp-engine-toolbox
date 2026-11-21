/**
 * The {@link domain/repository/source-control.repository!SourceControl} port implemented with the `git` command line.
 *
 * @module
 */
import { homedir } from 'node:os'
import type { Commit } from '../../domain/model/commit.model'
import type { GitRemote } from '../../domain/model/git-remote.model'
import type { ShellResult } from '../../domain/repository/shell.repository'
import type { CloneRequest, MergeOutcome, SourceControl, SourceControlFactory } from '../../domain/repository/source-control.repository'
import { Loopback } from '../http/loopback'
import { ProcessRunner } from '../process/process.runner'

const ORIGIN = 'origin'
const NETWORK_COMMANDS: ReadonlySet<string> = new Set<string>(['push', 'fetch', 'pull', 'ls-remote'])
const NO_PROMPT: Readonly<Record<string, string>> = { GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=15' }

/**
 * {@link domain/repository/source-control.repository!SourceControl} for one working copy, running the `git` CLI in its folder.
 *
 * Queries return `false` or `null` when git fails; the commands that change the
 * repository (`init`, `add`, `commit`, `tag`, `push`, `remote`) throw an `Error`
 * with git's standard error when git exits non-zero.
 *
 * In a dev container the commands that reach a remote (`push`, `fetch`, `pull`, `ls-remote`) reach a remote on the
 * computer's loopback (the local engine's git server) at `host.docker.internal`: each such remote's URL gets a
 * `url.<rewritten>.insteadOf` for that command only, so the remote, its name and its upstream stay as they are.
 */
export class GitCliRepository implements SourceControl {
  /**
   * Binds the repository to a working copy.
   *
   * @param cwd - The folder git runs in.
   */
  public constructor(private readonly cwd: string) {}

  /**
   * Tells whether the folder is inside a git working tree (`git rev-parse --is-inside-work-tree`).
   *
   * @returns `true` when git succeeds.
   */
  public async isRepository(): Promise<boolean> { return this.succeeds(['rev-parse', '--is-inside-work-tree']) }
  /**
   * Tells whether the repository has at least one commit (`git rev-parse --verify HEAD`).
   *
   * @returns `true` when `HEAD` resolves.
   */
  public async hasCommits(): Promise<boolean> { return this.succeeds(['rev-parse', '--verify', 'HEAD']) }
  /**
   * Reads the commit `HEAD` points at (`git rev-parse HEAD`).
   *
   * @returns The full commit hash, or `null` when there is none.
   */
  public async head(): Promise<string | null> { return this.answer(['rev-parse', 'HEAD']) }
  /**
   * Reads the checked-out branch (`git rev-parse --abbrev-ref HEAD`).
   *
   * @returns The branch name (`HEAD` when detached), or `null` when git fails.
   */
  public async branch(): Promise<string | null> { return this.answer(['rev-parse', '--abbrev-ref', 'HEAD']) }
  /**
   * Reads the URL of the `origin` remote (`git remote get-url origin`).
   *
   * @returns The URL, or `null` when there is no `origin`.
   */
  public async remote(): Promise<string | null> { return this.answer(['remote', 'get-url', ORIGIN]) }
  /**
   * Finds the latest version tag reachable from `HEAD` (`git describe --tags --abbrev=0 --match v[0-9]*`).
   *
   * @returns The tag name, or `null` when there is no version tag.
   */
  public async lastTag(): Promise<string | null> { return this.answer(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*']) }

  /**
   * Reads the default branch of `origin` from `refs/remotes/origin/HEAD`.
   *
   * @returns The branch name without the `origin/` prefix, or `null` when it is not known locally.
   */
  public async defaultBranch(): Promise<string | null> {
    return (await this.answer(['symbolic-ref', '--short', `refs/remotes/${ORIGIN}/HEAD`]))?.replace(/^origin\//, '') ?? null
  }

  /**
   * Tells whether the working copy has no changes (`git status --porcelain` is empty).
   *
   * @returns `true` when nothing is modified, staged or untracked.
   * @throws `Error` when git fails.
   */
  public async isClean(): Promise<boolean> {
    return (await this.must(['status', '--porcelain'])).trim() === ''
  }

  /**
   * Fetches the tags of `origin` (`git fetch --tags --quiet origin`); a failure is ignored.
   */
  public async fetchTags(): Promise<void> {
    await this.git(['fetch', '--tags', '--quiet', ORIGIN])
  }

  /**
   * Lists the commits after a reference up to `HEAD` (`git log ref..HEAD`), newest first.
   *
   * @param ref - The reference to start after, usually the last tag; `null` lists the whole history.
   * @returns The hash and subject of each commit, or an empty list when git fails.
   */
  public async commitsSince(ref: string | null): Promise<Commit[]> {
    const result: ShellResult = await this.git(['log', '--format=%H%x09%s', ...(ref ? [`${ref}..HEAD`] : ['HEAD'])])
    if (result.code !== 0) return []
    return result.stdout.split('\n').filter(Boolean).map((line: string): Commit => {
      const [sha = '', ...subject] = line.split('\t')
      return { sha, subject: subject.join('\t') }
    })
  }

  /**
   * Creates a repository in the folder (`git init -b branch`).
   *
   * @param branch - The name of the initial branch.
   * @throws `Error` when git fails.
   */
  public async init(branch: string): Promise<void> { await this.must(['init', '-b', branch]) }
  /**
   * Stages every change of the working copy (`git add -A`).
   *
   * @throws `Error` when git fails.
   */
  public async addAll(): Promise<void> { await this.must(['add', '-A']) }
  /**
   * Commits the staged changes (`git commit -m message`).
   *
   * @param message - The commit message.
   * @throws `Error` when git fails, for example when nothing is staged.
   */
  public async commit(message: string): Promise<void> { await this.must(['commit', '-m', message]) }
  /**
   * Creates an annotated tag on `HEAD` (`git tag -a name -m message`).
   *
   * @param name - The tag name, such as `v1.2.0`.
   * @param message - The tag message.
   * @throws `Error` when git fails, for example when the tag exists.
   */
  public async tag(name: string, message: string): Promise<void> { await this.must(['tag', '-a', name, '-m', message]) }
  /**
   * Pushes with the given arguments (`git push …`).
   *
   * @param args - The arguments after `push`, such as the remote and the refs.
   * @throws `Error` when git fails.
   */
  public async push(args: readonly string[]): Promise<void> { await this.must(['push', ...args]) }

  /**
   * Points `origin` at a URL, adding the remote when it is missing.
   *
   * @param url - The remote URL.
   * @throws `Error` when git fails.
   */
  public async setRemote(url: string): Promise<void> {
    await this.setRemoteUrl(ORIGIN, url)
  }

  /**
   * Reads the URL of a remote (`git remote get-url name`).
   *
   * @param name - The remote name.
   * @returns The URL, or `null` when the remote does not exist.
   */
  public async remoteUrl(name: string): Promise<string | null> { return this.answer(['remote', 'get-url', name]) }

  /**
   * Lists the remotes of the repository with their URLs (`git remote`, then `git remote get-url` each).
   *
   * @returns The remotes; an empty list when there are none or git fails.
   */
  public async remotes(): Promise<GitRemote[]> {
    const names: string[] = ((await this.answer(['remote'])) ?? '').split('\n').map((name: string) => name.trim()).filter(Boolean)
    const remotes: GitRemote[] = []
    for (const name of names) remotes.push({ name, url: (await this.remoteUrl(name)) ?? '' })
    return remotes
  }

  /**
   * Sets the URL of a remote: `git remote set-url` when it exists, `git remote add` otherwise.
   *
   * @param name - The remote name.
   * @param url - The remote URL.
   * @throws `Error` when git fails.
   */
  public async setRemoteUrl(name: string, url: string): Promise<void> {
    await this.must((await this.remoteUrl(name)) ? ['remote', 'set-url', name, url] : ['remote', 'add', name, url])
  }

  /**
   * Renames a remote (`git remote rename from to`).
   *
   * @param from - The current name.
   * @param to - The new name.
   * @throws `Error` when git fails.
   */
  public async renameRemote(from: string, to: string): Promise<void> { await this.must(['remote', 'rename', from, to]) }

  /**
   * Fetches a remote without prompting for credentials (`git fetch --quiet remote`).
   *
   * @param remote - The remote name.
   * @throws `Error` with git's standard error when git fails.
   */
  public async fetch(remote: string): Promise<void> {
    await ProcessRunner.runOrThrow('git', [...(await this.reach(['fetch'])), 'fetch', '--quiet', remote], this.cwd, NO_PROMPT)
  }

  /**
   * Reads `refs/remotes/<remote>/HEAD`; when it is missing, sets it from the remote (`git remote set-head --auto`) and reads it again.
   *
   * @param remote - The remote name.
   * @returns The branch name without the remote prefix, or `null` when git cannot tell.
   */
  public async remoteHead(remote: string): Promise<string | null> {
    const read = async (): Promise<string | null> => (await this.answer(['symbolic-ref', '--short', `refs/remotes/${remote}/HEAD`]))?.replace(`${remote}/`, '') ?? null
    const known: string | null = await read()
    if (known) return known
    await ProcessRunner.run('git', ['remote', 'set-head', remote, '--auto'], this.cwd, NO_PROMPT)
    return read()
  }

  /**
   * Merges a reference (`git merge --no-edit ref`); on failure lists the unmerged files (`git diff --name-only --diff-filter=U`).
   *
   * @param ref - The reference to merge.
   * @returns `upToDate`, `merged`, or `conflict` with the files.
   * @throws `Error` with git's standard error when the merge fails without conflicts.
   */
  public async merge(ref: string): Promise<MergeOutcome> {
    const before: string | null = await this.head()
    const result: ShellResult = await this.git(['merge', '--no-edit', ref])
    if (result.code === 0) return { state: before === (await this.head()) ? 'upToDate' : 'merged', conflicts: [] }
    const conflicts: string[] = ((await this.answer(['diff', '--name-only', '--diff-filter=U'])) ?? '').split('\n').filter(Boolean)
    if (conflicts.length === 0) throw new Error(`git merge ${ref}: ${result.stderr.trim() || result.stdout.trim()}`)
    return { state: 'conflict', conflicts }
  }

  private async git(args: readonly string[]): Promise<ShellResult> {
    return ProcessRunner.run('git', [...(await this.reach(args)), ...args], this.cwd)
  }

  private async must(args: readonly string[]): Promise<string> {
    return ProcessRunner.runOrThrow('git', [...(await this.reach(args)), ...args], this.cwd)
  }

  private async reach(args: readonly string[]): Promise<string[]> {
    if (!NETWORK_COMMANDS.has(args[0] ?? '') || !Loopback.inDevContainer()) return []
    const options: string[] = []
    for (const remote of await this.remotes()) {
      const reached: string = Loopback.reach(remote.url)
      if (reached !== remote.url) options.push('-c', `url.${reached}.insteadOf=${remote.url}`)
    }
    return options
  }

  private async succeeds(args: readonly string[]): Promise<boolean> {
    return (await this.git(args)).code === 0
  }

  private async answer(args: readonly string[]): Promise<string | null> {
    const result: ShellResult = await this.git(args)
    return result.code === 0 ? result.stdout.trim() : null
  }
}

/**
 * {@link domain/repository/source-control.repository!SourceControlFactory} that hands out a {@link GitCliRepository} per folder.
 */
export class GitCliFactory implements SourceControlFactory {
  /**
   * Opens the working copy in a folder.
   *
   * @param folder - The folder of the working copy.
   * @returns A {@link GitCliRepository} running git in that folder.
   */
  public at(folder: string): SourceControl {
    return new GitCliRepository(folder)
  }

  /**
   * Reads the user's name from the global git configuration (`git config user.name`, run in the home folder).
   *
   * @returns The name, or an empty string when it is not set.
   */
  public async userName(): Promise<string> {
    return (await ProcessRunner.run('git', ['config', 'user.name'], homedir())).stdout.trim()
  }

  /**
   * Clones a repository (`git clone [--filter=blob:none] [--branch ref] url folder`), run in the home folder with
   * prompts switched off and SSH in batch mode.
   *
   * @param request - The address, the folder, the branch and whether the clone is partial.
   * @throws `Error` with git's standard error when git fails.
   */
  public async clone(request: CloneRequest): Promise<void> {
    const options: string[] = [...(request.partial ? ['--filter=blob:none'] : []), ...(request.ref ? ['--branch', request.ref] : [])]
    await ProcessRunner.runOrThrow('git', [...GitCliFactory.reachOptions(request.url), 'clone', ...options, '--', request.url, request.folder], homedir(), NO_PROMPT)
  }

  /**
   * Lists a remote's `HEAD` (`git ls-remote url HEAD`) with prompts switched off and SSH in batch mode.
   *
   * @param url - The address.
   * @returns `true` when git succeeds.
   */
  public async reachable(url: string): Promise<boolean> {
    return (await ProcessRunner.run('git', [...GitCliFactory.reachOptions(url), 'ls-remote', '--', url, 'HEAD'], homedir(), NO_PROMPT)).code === 0
  }

  private static reachOptions(url: string): string[] {
    const reached: string = Loopback.reach(url)
    return reached === url ? [] : ['-c', `url.${reached}.insteadOf=${url}`]
  }
}
