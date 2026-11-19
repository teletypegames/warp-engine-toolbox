import { homedir } from 'node:os'
import type { Commit } from '../../domain/model/commit.model'
import type { ShellResult } from '../../domain/repository/shell.repository'
import type { SourceControl, SourceControlFactory } from '../../domain/repository/source-control.repository'
import { ProcessRunner } from '../process/process.runner'

const ORIGIN = 'origin'

export class GitCliRepository implements SourceControl {
  public constructor(private readonly cwd: string) {}

  public async isRepository(): Promise<boolean> { return this.succeeds(['rev-parse', '--is-inside-work-tree']) }
  public async hasCommits(): Promise<boolean> { return this.succeeds(['rev-parse', '--verify', 'HEAD']) }
  public async head(): Promise<string | null> { return this.answer(['rev-parse', 'HEAD']) }
  public async branch(): Promise<string | null> { return this.answer(['rev-parse', '--abbrev-ref', 'HEAD']) }
  public async remote(): Promise<string | null> { return this.answer(['remote', 'get-url', ORIGIN]) }
  public async lastTag(): Promise<string | null> { return this.answer(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*']) }

  public async defaultBranch(): Promise<string | null> {
    return (await this.answer(['symbolic-ref', '--short', `refs/remotes/${ORIGIN}/HEAD`]))?.replace(/^origin\//, '') ?? null
  }

  public async isClean(): Promise<boolean> {
    return (await this.must(['status', '--porcelain'])).trim() === ''
  }

  public async fetchTags(): Promise<void> {
    await this.git(['fetch', '--tags', '--quiet', ORIGIN])
  }

  public async commitsSince(ref: string | null): Promise<Commit[]> {
    const result: ShellResult = await this.git(['log', '--format=%H%x09%s', ...(ref ? [`${ref}..HEAD`] : ['HEAD'])])
    if (result.code !== 0) return []
    return result.stdout.split('\n').filter(Boolean).map((line: string): Commit => {
      const [sha = '', ...subject] = line.split('\t')
      return { sha, subject: subject.join('\t') }
    })
  }

  public async init(branch: string): Promise<void> { await this.must(['init', '-b', branch]) }
  public async addAll(): Promise<void> { await this.must(['add', '-A']) }
  public async commit(message: string): Promise<void> { await this.must(['commit', '-m', message]) }
  public async tag(name: string, message: string): Promise<void> { await this.must(['tag', '-a', name, '-m', message]) }
  public async push(args: readonly string[]): Promise<void> { await this.must(['push', ...args]) }

  public async setRemote(url: string): Promise<void> {
    await this.setRemoteUrl(ORIGIN, url)
  }

  public async remoteUrl(name: string): Promise<string | null> { return this.answer(['remote', 'get-url', name]) }

  public async setRemoteUrl(name: string, url: string): Promise<void> {
    await this.must((await this.remoteUrl(name)) ? ['remote', 'set-url', name, url] : ['remote', 'add', name, url])
  }

  private async git(args: readonly string[]): Promise<ShellResult> {
    return ProcessRunner.run('git', args, this.cwd)
  }

  private async must(args: readonly string[]): Promise<string> {
    return ProcessRunner.runOrThrow('git', args, this.cwd)
  }

  private async succeeds(args: readonly string[]): Promise<boolean> {
    return (await this.git(args)).code === 0
  }

  private async answer(args: readonly string[]): Promise<string | null> {
    const result: ShellResult = await this.git(args)
    return result.code === 0 ? result.stdout.trim() : null
  }
}

export class GitCliFactory implements SourceControlFactory {
  public at(folder: string): SourceControl {
    return new GitCliRepository(folder)
  }

  public async userName(): Promise<string> {
    return (await ProcessRunner.run('git', ['config', 'user.name'], homedir())).stdout.trim()
  }
}
