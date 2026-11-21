import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { PublicSoftware, SoftwareFork } from '../../../../src/domain/model/fork.model'
import { DomainError, type Message } from '../../../../src/domain/model/message.model'
import type { PublicCatalogRepository } from '../../../../src/domain/repository/public-catalog.repository'
import { CloneService } from '../../../../src/domain/service/clone.service'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import { FakeGitFactory, MemoryFiles } from '../../fakes'

const HTTPS = 'https://git.example/games/rabbit.git'
const SSH = 'git@git.example:games/rabbit.git'
const SOFTWARE: PublicSoftware = {
  name: 'rabbit', title: 'Rabbit', author: 'Ann', license: null, latestVersion: '1.2.0',
  source: { url: HTTPS, sshUrl: SSH, ref: null, public: true }, forksAllowed: true, forkOf: null, forksCount: 1
}

class Catalog implements PublicCatalogRepository {
  public async softwares(): Promise<PublicSoftware[]> { return Promise.resolve([SOFTWARE]) }
  public async software(name: string): Promise<PublicSoftware | null> { return Promise.resolve(name === SOFTWARE.name ? SOFTWARE : null) }
  public async forks(): Promise<SoftwareFork[]> { return Promise.resolve([{ engine: 'https://other.example', name: 'rabbit-bob', title: 'Rabbit Bob', local: false }]) }
}

function connection(): ConnectionService {
  return { hasHost: () => true, publicCatalog: async () => Promise.resolve(new Catalog()), hostUrl: () => 'https://games.example.org' } as unknown as ConnectionService
}

function setup(files: MemoryFiles = new MemoryFiles()): { service: CloneService, git: FakeGitFactory, steps: Message[] } {
  const git: FakeGitFactory = new FakeGitFactory()
  return { service: new CloneService(connection(), git, files), git, steps: [] }
}

describe('CloneService', () => {
  it('reads the public catalog by name and its forks', async () => {
    const { service } = setup()
    assert.equal((await service.softwares()).get('rabbit')?.title, 'Rabbit')
    assert.equal((await service.software('rabbit')).name, 'rabbit')
    await assert.rejects(service.software('hare'), DomainError)
    assert.equal((await service.forks('rabbit'))[0]?.name, 'rabbit-bob')
    assert.equal(service.engineUrl(), 'https://games.example.org')
  })

  it('clones over SSH when it answers', async () => {
    const { service, git, steps } = setup()
    git.reachableUrls.add(SSH)
    const folder: string = await service.clone({ software: SOFTWARE, parent: '/w', folderName: 'rabbit', partial: true, report: (step: Message) => steps.push(step) })
    assert.equal(folder, '/w/rabbit')
    assert.deepEqual(git.clones, [{ url: SSH, folder: '/w/rabbit', ref: null, partial: true }])
    assert.ok(steps.some((step: Message) => step.args.includes('SSH')))
  })

  it('falls back to HTTPS when SSH does not answer', async () => {
    const { service, git } = setup()
    await service.clone({ software: SOFTWARE, parent: '/w', folderName: 'rabbit', partial: false, report: () => undefined })
    assert.equal(git.clones[0]?.url, HTTPS)
  })

  it('refuses an existing folder with Try Again', async () => {
    const { service, git } = setup(new MemoryFiles({ '/w/rabbit': '' }))
    await assert.rejects(service.clone({ software: SOFTWARE, parent: '/w', folderName: 'rabbit', partial: true, report: () => undefined }),
      (error: unknown) => error instanceof DomainError && error.remedy === 'retryClone')
    assert.equal(git.clones.length, 0)
  })

  it('turns a refused sign-in into a message with Try Again', async () => {
    const { service, git } = setup()
    git.cloneError = new Error('git clone: fatal: Authentication failed for \'https://git.example/\'')
    await assert.rejects(service.clone({ software: SOFTWARE, parent: '/w', folderName: 'rabbit', partial: true, report: () => undefined }),
      (error: unknown) => error instanceof DomainError && error.remedy === 'retryClone' && error.message.startsWith('git could not sign in'))
  })

  it('has nothing to clone without a source', async () => {
    const { service } = setup()
    await assert.rejects(service.clone({ software: { ...SOFTWARE, source: null }, parent: '/w', folderName: 'rabbit', partial: true, report: () => undefined }), DomainError)
  })

  it('finds a dev container in the clone', async () => {
    const { service } = setup(new MemoryFiles({ '/w/rabbit/.devcontainer/devcontainer.json': '{}' }))
    assert.equal(await service.hasDevContainer('/w/rabbit'), true)
    assert.equal(await service.hasDevContainer('/w/hare'), false)
  })
})
