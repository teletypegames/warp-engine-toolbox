import type { Commit } from '../domain/changelog'
import { run, runOrThrow, type RunResult } from './process'

export class Git {
  private readonly cwd: string

  public constructor(cwd: string) {
    this.cwd = cwd
  }

  public async isRepository(): Promise<boolean> {
    return (await run('git', ['rev-parse', '--is-inside-work-tree'], this.cwd)).code === 0
  }

  public async head(): Promise<string | null> {
    const result: RunResult = await run('git', ['rev-parse', 'HEAD'], this.cwd)
    return result.code === 0 ? result.stdout.trim() : null
  }

  public async branch(): Promise<string | null> {
    const result: RunResult = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], this.cwd)
    return result.code === 0 ? result.stdout.trim() : null
  }

  public async isClean(): Promise<boolean> {
    return (await runOrThrow('git', ['status', '--porcelain'], this.cwd)).trim() === ''
  }

  public async remote(name: string = 'origin'): Promise<string | null> {
    const result: RunResult = await run('git', ['remote', 'get-url', name], this.cwd)
    return result.code === 0 ? result.stdout.trim() : null
  }

  public async fetchTags(): Promise<void> {
    await run('git', ['fetch', '--tags', '--quiet', 'origin'], this.cwd)
  }

  public async lastTag(): Promise<string | null> {
    const result: RunResult = await run('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], this.cwd)
    return result.code === 0 ? result.stdout.trim() : null
  }

  public async commitsSince(ref: string | null): Promise<Commit[]> {
    const range: string[] = ref ? [`${ref}..HEAD`] : ['HEAD']
    const result: RunResult = await run('git', ['log', '--format=%H%x09%s', ...range], this.cwd)
    if (result.code !== 0) return []
    return result.stdout.split('\n').filter(Boolean).map((line: string): Commit => {
      const [sha = '', ...subject] = line.split('\t')
      return { sha, subject: subject.join('\t') }
    })
  }

  public async init(branch: string): Promise<void> {
    await runOrThrow('git', ['init', '-b', branch], this.cwd)
  }

  public async addAll(): Promise<void> {
    await runOrThrow('git', ['add', '-A'], this.cwd)
  }

  public async add(files: readonly string[]): Promise<void> {
    await runOrThrow('git', ['add', '--', ...files], this.cwd)
  }

  public async commit(message: string): Promise<void> {
    await runOrThrow('git', ['commit', '-m', message], this.cwd)
  }

  public async hasCommits(): Promise<boolean> {
    return (await run('git', ['rev-parse', '--verify', 'HEAD'], this.cwd)).code === 0
  }

  public async setRemote(url: string, name: string = 'origin'): Promise<void> {
    const existing: string | null = await this.remote(name)
    await runOrThrow('git', existing ? ['remote', 'set-url', name, url] : ['remote', 'add', name, url], this.cwd)
  }

  public async tag(name: string, message: string): Promise<void> {
    await runOrThrow('git', ['tag', '-a', name, '-m', message], this.cwd)
  }

  public async push(args: readonly string[]): Promise<void> {
    await runOrThrow('git', ['push', ...args], this.cwd)
  }
}
