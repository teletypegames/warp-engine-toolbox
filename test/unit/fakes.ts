import type { Commit } from '../../src/domain/model/commit.model'
import type { FileQuery, FileSystemRepository } from '../../src/domain/repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../../src/domain/repository/source-control.repository'

export class MemoryFiles implements FileSystemRepository {
  public readonly files: Map<string, string> = new Map<string, string>()

  public constructor(initial: Record<string, string> = {}) {
    for (const [path, text] of Object.entries(initial)) this.files.set(path, text)
  }

  public async readText(path: string): Promise<string | null> { return Promise.resolve(this.files.get(path) ?? null) }
  public async writeText(path: string, text: string): Promise<void> { this.files.set(path, text); return Promise.resolve() }
  public async readBytes(path: string): Promise<Uint8Array> { return Promise.resolve(new TextEncoder().encode(this.files.get(path) ?? '')) }
  public async writeBytes(path: string, bytes: Uint8Array): Promise<void> { this.files.set(path, new TextDecoder().decode(bytes)); return Promise.resolve() }
  public async exists(path: string): Promise<boolean> { return Promise.resolve(this.files.has(path)) }
  public async modifiedAt(): Promise<number> { return Promise.resolve(0) }

  public async find(query: FileQuery): Promise<string[]> {
    const suffix: string = query.include.replace(/^\*\*\/|^\*/g, '').replace(/^\*/, '')
    return Promise.resolve([...this.files.keys()].filter((path: string) => path.startsWith(query.folder) && path.endsWith(suffix)))
  }
}

export class FakeGit implements SourceControl {
  public readonly calls: string[] = []
  public repository = true
  public origin: string | null = 'git@host:games/rabbit.git'
  public clean = true
  public readonly named: Map<string, string> = new Map<string, string>()
  public commits: Commit[] = [{ sha: 'abcdef1234', subject: 'Faster rabbit' }]

  public async isRepository(): Promise<boolean> { return Promise.resolve(this.repository) }
  public async head(): Promise<string | null> { return Promise.resolve('abc') }
  public async branch(): Promise<string | null> { return Promise.resolve('master') }
  public async defaultBranch(): Promise<string | null> { return Promise.resolve('master') }
  public async isClean(): Promise<boolean> { return Promise.resolve(this.clean) }
  public async remote(): Promise<string | null> { return Promise.resolve(this.origin) }
  public async hasCommits(): Promise<boolean> { return Promise.resolve(true) }
  public async fetchTags(): Promise<void> { this.calls.push('fetch'); return Promise.resolve() }
  public async lastTag(): Promise<string | null> { return Promise.resolve('v0.1.0') }
  public async commitsSince(): Promise<Commit[]> { return Promise.resolve(this.commits) }
  public async init(branch: string): Promise<void> { this.calls.push(`init ${branch}`); return Promise.resolve() }
  public async addAll(): Promise<void> { this.calls.push('add'); this.clean = true; return Promise.resolve() }
  public async commit(message: string): Promise<void> { this.calls.push(`commit ${message}`); return Promise.resolve() }
  public async setRemote(url: string): Promise<void> { this.calls.push(`remote ${url}`); return Promise.resolve() }
  public async remoteUrl(name: string): Promise<string | null> { return Promise.resolve(this.named.get(name) ?? null) }
  public async remotes(): Promise<{ name: string, url: string }[]> {
    const all: { name: string, url: string }[] = this.origin ? [{ name: 'origin', url: this.origin }] : []
    return Promise.resolve([...all, ...[...this.named.entries()].map(([name, url]) => ({ name, url }))])
  }
  public async setRemoteUrl(name: string, url: string): Promise<void> { this.calls.push(`remote ${name} ${url}`); this.named.set(name, url); return Promise.resolve() }
  public async tag(name: string): Promise<void> { this.calls.push(`tag ${name}`); return Promise.resolve() }
  public async push(args: readonly string[]): Promise<void> { this.calls.push(`push ${args.join(' ')}`); return Promise.resolve() }
}

export class FakeGitFactory implements SourceControlFactory {
  public constructor(public readonly git: FakeGit = new FakeGit()) {}

  public at(): SourceControl { return this.git }
  public async userName(): Promise<string> { return Promise.resolve('Tester') }
}
