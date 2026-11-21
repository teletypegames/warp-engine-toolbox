import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Principal, Software } from '../../../../src/domain/model/catalog.model'
import type { PublicSoftware } from '../../../../src/domain/model/fork.model'
import type { Host } from '../../../../src/domain/model/host.model'
import { DomainError } from '../../../../src/domain/model/message.model'
import type { Platform } from '../../../../src/domain/model/platform.model'
import type { Project } from '../../../../src/domain/model/project.model'
import type { Session } from '../../../../src/domain/model/sign-in.model'
import type { CatalogRepository } from '../../../../src/domain/repository/catalog.repository'
import type { HostRepository } from '../../../../src/domain/repository/host.repository'
import type { ShellRepository } from '../../../../src/domain/repository/shell.repository'
import type { AdminRepositories, WarpEngineGateway } from '../../../../src/domain/repository/warp-engine.gateway'
import { CloneService } from '../../../../src/domain/service/clone.service'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import { ForkService, type ForkTarget } from '../../../../src/domain/service/fork.service'
import { HostService } from '../../../../src/domain/service/host.service'
import type { PlatformService } from '../../../../src/domain/service/platform.service'
import { ProjectService } from '../../../../src/domain/service/project.service'
import type { SignInService } from '../../../../src/domain/service/sign-in.service'
import { FakeGit, FakeGitFactory, MemoryFiles } from '../../fakes'
import { C64 } from '../../fixtures'

const TARGET = 'https://own.example'
const OTHER = 'https://other.example'
const ORIGINAL: PublicSoftware = {
  name: 'rabbit', title: 'Rabbit', author: 'Ann', license: null, latestVersion: '1.2.0',
  source: { url: 'https://git.example/games/rabbit.git', sshUrl: null, ref: null, public: true }, forksAllowed: true, forkOf: null, forksCount: 0
}

class Hosts implements HostRepository {
  public configuredUrl(): string { return 'https://teletypegames.org' }
  public configuredHosts(): Host[] { return [{ name: 'own', url: TARGET }, { name: 'other', url: OTHER }] }
  public async saveUrl(): Promise<void> { return Promise.resolve() }
  public async saveHosts(): Promise<void> { return Promise.resolve() }
}

function gateway(taken: readonly string[]): WarpEngineGateway {
  const catalog: Partial<CatalogRepository> = {
    me: async (): Promise<Principal> => Promise.resolve({ label: 'Bob Builder', scopes: ['admin:read'] }),
    softwareByName: async (name: string): Promise<Software | null> => Promise.resolve(taken.includes(name) ? { name } as Software : null)
  }
  return { admin: (): AdminRepositories => ({ catalog } as unknown as AdminRepositories) } as unknown as WarpEngineGateway
}

function sessions(): SignInService {
  const stored: Session[] = [{ id: '1', host: TARGET, token: 'tok', label: 'Bob', scopes: [] }]
  return { forHost: async (url: string) => Promise.resolve(stored.filter((session: Session) => session.host === url)) } as unknown as SignInService
}

function setup(taken: readonly string[] = []): { service: ForkService, files: MemoryFiles, git: FakeGit } {
  const files: MemoryFiles = new MemoryFiles()
  const git: FakeGit = new FakeGit()
  const factory: FakeGitFactory = new FakeGitFactory(git)
  factory.onClone = (request): void => {
    files.files.set(`${request.folder}/.woodpecker.yaml`, 'platform: c64\n')
    files.files.set(`${request.folder}/metadata.json`, JSON.stringify({ name: 'rabbit', title: 'Rabbit', author: 'Ann', repo: 'https://git.example/games/rabbit' }))
  }
  git.origin = 'https://git.example/games/rabbit.git'
  const platforms: PlatformService = { find: async (name: string | null): Promise<Platform | null> => Promise.resolve(name === 'c64' ? C64 : null) } as unknown as PlatformService
  const shell: ShellRepository = { run: async () => Promise.resolve({ code: 0, stdout: '', stderr: '' }) }
  const connection: ConnectionService = { hostUrl: () => 'https://teletypegames.org' } as unknown as ConnectionService
  const service: ForkService = new ForkService({
    gateway: gateway(taken), hosts: new HostService(new Hosts()), signIn: sessions(), clone: new CloneService(connection, factory, files),
    projects: new ProjectService(files, platforms, shell), sourceControl: factory, files
  })
  return { service, files, git }
}

describe('ForkService', () => {
  it('offers only the hosts with a session, with who is signed in', async () => {
    const targets: ForkTarget[] = await setup().service.targets()
    assert.deepEqual(targets.map((target: ForkTarget) => [target.host.url, target.user]), [[TARGET, 'Bob Builder']])
  })

  it('suggests <name>-<user>, numbered while the target has it', async () => {
    const target: ForkTarget = { host: { name: 'own', url: TARGET }, user: 'Bob Builder' }
    assert.equal(await setup().service.suggestName(target, ORIGINAL), 'rabbit-bob-builder')
    assert.equal(await setup(['rabbit-bob-builder', 'rabbit-bob-builder-2']).service.suggestName(target, ORIGINAL), 'rabbit-bob-builder-3')
    assert.equal(await setup(['x']).service.isFree(target, 'x'), false)
  })

  it('refuses a host without a session and a software that may not be forked', async () => {
    await assert.rejects(setup().service.isFree({ host: { name: 'other', url: OTHER }, user: null }, 'x'), DomainError)
    assert.throws(() => { setup().service.check({ ...ORIGINAL, forksAllowed: false }) }, DomainError)
  })

  it('clones the whole history, renames origin to upstream, rewrites the metadata and commits', async () => {
    const { service, files, git } = setup()
    const project: Project = await service.fork({ original: ORIGINAL, engine: 'https://teletypegames.org/', name: 'rabbit-bob', title: 'Rabbit Bob', parent: '/w', report: () => undefined })
    assert.equal(project.folder, '/w/rabbit-bob')
    assert.equal(project.name, 'rabbit-bob')
    assert.deepEqual(git.calls, ['rename origin upstream', 'add', 'commit Fork of Rabbit from teletypegames.org'])
    assert.equal(git.origin, null)
    assert.equal(git.named.get('upstream'), 'https://git.example/games/rabbit.git')
    assert.deepEqual(JSON.parse(files.files.get('/w/rabbit-bob/metadata.json') ?? '{}'), {
      name: 'rabbit-bob', title: 'Rabbit Bob', author: 'Ann', fork_of_engine: 'https://teletypegames.org', fork_of_name: 'rabbit',
      fork_of_version: '1.2.0', fork_of_repo: 'https://git.example/games/rabbit.git'
    })
  })

  it('writes the licence chosen for the fork', async () => {
    const { service, files } = setup()
    const project: Project = await service.fork({ original: ORIGINAL, engine: 'https://teletypegames.org', name: 'rabbit-bob', title: 'Rabbit Bob', parent: '/w', report: () => undefined })
    await service.setLicense(project, 'MIT')
    assert.equal((JSON.parse(files.files.get('/w/rabbit-bob/metadata.json') ?? '{}') as { license?: string }).license, 'MIT')
  })
})
