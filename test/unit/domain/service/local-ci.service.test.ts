import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { ScaffoldRequest, ScaffoldResult, Software } from '../../../../src/domain/model/catalog.model'
import { LocalCi, type LocalComponent, type LocalCredentials, type LocalOperation } from '../../../../src/domain/model/local-ci.model'
import type { WellKnown } from '../../../../src/domain/model/local-engine.model'
import { Marker } from '../../../../src/domain/model/marker.model'
import { DomainError, type Message } from '../../../../src/domain/model/message.model'
import { Metadata } from '../../../../src/domain/model/metadata.model'
import { Project } from '../../../../src/domain/model/project.model'
import type { LocalComponentRepository } from '../../../../src/domain/repository/local-component.repository'
import type { AdminRepositories, WarpEngineGateway } from '../../../../src/domain/repository/warp-engine.gateway'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import { HostService } from '../../../../src/domain/service/host.service'
import { LocalCiService } from '../../../../src/domain/service/local-ci.service'
import { LocalEngineService } from '../../../../src/domain/service/local-engine.service'
import type { ProjectService } from '../../../../src/domain/service/project.service'
import { ReleaseService } from '../../../../src/domain/service/release.service'
import { FakeGitFactory, MemoryFiles } from '../../fakes'
import { C64 } from '../../fixtures'

const LOCAL = 'http://127.0.0.1:7470'
const PUSH = 'http://warp:tok@localhost:7471/games/rabbit.git'

function operation(state: LocalOperation['state'], steps: string[], result: Record<string, unknown> | null = null, error: string | null = null): LocalOperation {
  return { id: 3, kind: 'local_ci', target: '1', state, steps: steps.map((text: string) => ({ at: '', text })), result, error }
}

class Components implements LocalComponentRepository {
  public polls: LocalOperation[] = []
  public setUpFor: number[] = []
  public async components(): Promise<LocalComponent[]> { return Promise.resolve([]) }
  public async enable(): Promise<LocalOperation> { return Promise.resolve(operation('queued', [])) }
  public async disable(): Promise<LocalOperation> { return Promise.resolve(operation('queued', [])) }
  public async remove(): Promise<LocalOperation> { return Promise.resolve(operation('queued', [])) }
  public async credentials(): Promise<LocalCredentials> { return Promise.resolve({ url: '', user: '', password: '' }) }
  public async operation(): Promise<LocalOperation> {
    const next: LocalOperation | undefined = this.polls.shift()
    return next ? Promise.resolve(next) : Promise.reject(new Error('no more polls'))
  }
  public async setUpCi(softwareId: number): Promise<LocalOperation> { this.setUpFor.push(softwareId); return Promise.resolve(operation('queued', ['queued'])) }
}

function project(): Project {
  return new Project({
    folder: '/games/rabbit', folderName: 'rabbit', markerPath: '/games/rabbit/.woodpecker.yaml', marker: Marker.parse('platform: c64\n'),
    platform: C64, metadataPath: '/games/rabbit/metadata.json', metadataFormat: 'json', metadata: Metadata.parse('{"name":"rabbit","version":"0.1.0"}', 'json')
  })
}

async function world(known: Software | null): Promise<{ service: LocalCiService, components: Components, git: FakeGitFactory, scaffolded: string[] }> {
  const wellKnown: WellKnown = { engine: 'warp-engine', version: '5.4.0', api: 2, name: 'Local', profile: 'local', signIn: [], adminApi: '/api/admin/v1',
                                 admin: false, sync: { inbound: false, target: null } }
  const hosts: HostService = new HostService({ configuredUrl: () => '', configuredHosts: () => [], saveUrl: async () => Promise.resolve(), saveHosts: async () => Promise.resolve() })
  const local: LocalEngineService = new LocalEngineService({ probe: async (url: string) => Promise.resolve(url === LOCAL ? wellKnown : null) },
                                                           { port: async () => Promise.resolve(null), tokenFile: async () => Promise.resolve('tok'), tokenFromContainer: async () => Promise.resolve(null) }, hosts)
  await local.discover()
  const components: Components = new Components()
  const scaffolded: string[] = []
  const catalog = {
    softwareByName: async (): Promise<Software | null> => Promise.resolve(known),
    scaffold: async (request: ScaffoldRequest): Promise<ScaffoldResult> => {
      scaffolded.push(request.name)
      return Promise.resolve({ software: { id: 9, name: request.name } as Software, repository: { owner: 'games', name: request.name, htmlUrl: null, cloneUrl: null, sshUrl: null }, pipelineId: null, warnings: [] } as ScaffoldResult)
    }
  }
  const gateway = { admin: (): AdminRepositories => ({ catalog, local: components } as unknown as AdminRepositories) } as unknown as WarpEngineGateway
  const git: FakeGitFactory = new FakeGitFactory()
  return { service: new LocalCiService({ gateway, local, sourceControl: git, wait: async () => Promise.resolve() }), components, git, scaffolded }
}

describe('LocalCiService', () => {
  it('follows the operation, reports its steps once, and pushes to the warp remote', async () => {
    const { service, components, git, scaffolded } = await world({ id: 4, name: 'rabbit' } as Software)
    components.polls = [operation('running', ['queued', 'start warp-local-gitea']),
                        operation('succeeded', ['queued', 'start warp-local-gitea', 'let warp push'], { pushUrl: PUSH, remoteName: 'warp', warnings: [] })]
    const reported: string[] = []

    const setup = await service.setUp(project(), (message: Message) => { reported.push(String(message.args[0] ?? message.text)) })

    assert.deepEqual(components.setUpFor, [4])
    assert.deepEqual(scaffolded, [])
    assert.equal(setup.pushUrl, PUSH)
    assert.deepEqual(reported.filter((text: string) => ['queued', 'start warp-local-gitea', 'let warp push'].includes(text)), ['queued', 'start warp-local-gitea', 'let warp push'])
    assert.equal(git.git.remotes.get('warp'), PUSH)
    assert.ok(git.git.calls.includes('push -u warp master'), git.git.calls.join(', '))
  })

  it('puts a project the local catalog does not know there first', async () => {
    const { service, components, scaffolded } = await world(null)
    components.polls = [operation('succeeded', [], { pushUrl: PUSH })]

    await service.setUp(project(), () => undefined)

    assert.deepEqual(scaffolded, ['rabbit'])
    assert.deepEqual(components.setUpFor, [9])
  })

  it('fails with the engine\'s reason', async () => {
    const { service, components } = await world({ id: 4, name: 'rabbit' } as Software)
    components.polls = [operation('failed', ['pull gitea'], null, 'no Docker socket')]

    await assert.rejects(service.setUp(project(), () => undefined), (error: unknown) => error instanceof DomainError && error.message.includes('no Docker socket'))
  })

  it('offers what fits a component\'s state', () => {
    const component = (state: LocalComponent['state']): LocalComponent => ({ key: 'gitea', label: 'Git', role: 'forge', requires: [], description: '', state, message: null })
    assert.deepEqual(LocalCi.actions(component('off')), ['enable'])
    assert.deepEqual(LocalCi.actions(component('ready')), ['disable', 'remove'])
    assert.deepEqual(LocalCi.actions(component('unavailable')), [])
  })
})

describe('ReleaseService on a local engine', () => {
  it('pushes the tag to the warp remote when the local engine is the host', async () => {
    const git: FakeGitFactory = new FakeGitFactory()
    git.git.remotes.set('warp', PUSH)
    let local = true
    const releases: ReleaseService = new ReleaseService({ sourceControl: git, files: new MemoryFiles(), connection: Object.create(null) as ConnectionService,
                                                          projects: Object.create(null) as ProjectService, localHost: () => local })

    assert.equal(await releases.pushRemote(git.git), 'warp')
    local = false
    assert.equal(await releases.pushRemote(git.git), 'origin')
    git.git.origin = null
    assert.equal(await releases.pushRemote(git.git), null)
  })
})
