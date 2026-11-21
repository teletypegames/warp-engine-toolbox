import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Host } from '../../../../src/domain/model/host.model'
import type { WellKnown } from '../../../../src/domain/model/local-engine.model'
import type { HostDiagnosis } from '../../../../src/domain/model/repair.model'
import type { ServerContainer } from '../../../../src/domain/model/server.model'
import type { ContainerRuntime, DockerAvailability } from '../../../../src/domain/repository/container-runtime.repository'
import type { LocalEngineRepository } from '../../../../src/domain/repository/local-engine.repository'
import { HostService } from '../../../../src/domain/service/host.service'
import { RepairService } from '../../../../src/domain/service/repair.service'

const LOCAL = 'http://127.0.0.1:7470'
const INFO: WellKnown = { engine: 'warp-engine', version: '5.5.3', api: 2, name: 'Local', profile: 'local', signIn: [], adminApi: null, admin: false, sync: { inbound: false, target: null } }

function engine(state: string, name: string = 'warp-engine-local'): ServerContainer {
  return { id: name, name, image: 'warp-engine-local:1.4.1', state, status: state, hostPorts: [7470], folder: null }
}

interface Setup {
  readonly url?: string
  readonly answering?: readonly string[]
  readonly docker?: DockerAvailability
  readonly containers?: ServerContainer[]
  readonly port?: number | null
  readonly dataFolder?: string | null
  readonly configured?: boolean
  readonly inside?: boolean
}

function service(setup: Setup): RepairService {
  const url: string = setup.url ?? LOCAL
  const hosts: HostService = new HostService({ configuredUrl: () => url, configuredHosts: (): Host[] => [], saveUrl: async () => Promise.resolve(), saveHosts: async () => Promise.resolve() })
  const local: LocalEngineRepository = {
    port: async () => Promise.resolve(setup.port ?? null), tokenFile: async () => Promise.resolve(null), tokenFromContainer: async () => Promise.resolve(null),
    dataFolder: async () => Promise.resolve(setup.dataFolder ?? null), configured: async () => Promise.resolve(setup.configured ?? false)
  }
  const runtime: Pick<ContainerRuntime, 'availability' | 'containers'> = {
    availability: async () => Promise.resolve(setup.docker ?? 'ok'),
    containers: async () => Promise.resolve(setup.containers ?? [])
  }
  return new RepairService({
    hosts, local, runtime: runtime as ContainerRuntime, inside: () => setup.inside ?? false,
    discovery: { probe: async (probed: string) => Promise.resolve((setup.answering ?? []).includes(probed) ? INFO : null) }
  }, async () => Promise.resolve())
}

describe('RepairService', () => {
  it('says when the host answers', async () => {
    assert.deepEqual(await service({ answering: [LOCAL] }).diagnose(), { kind: 'answers', url: LOCAL })
  })

  it('does not look at Docker for a host on another machine', async () => {
    assert.deepEqual(await service({ url: 'https://games.example.org', docker: 'down' }).diagnose(), { kind: 'remote', url: 'https://games.example.org' })
  })

  it('cannot look at Docker from a dev container', async () => {
    assert.equal((await service({ inside: true, docker: 'down' }).diagnose()).kind, 'inside')
  })

  it('tells a missing Docker from one that does not run', async () => {
    assert.equal((await service({ docker: 'missing' }).diagnose()).kind, 'dockerMissing')
    assert.equal((await service({ docker: 'down' }).diagnose()).kind, 'dockerDown')
  })

  it('finds an engine whose containers are gone but whose data stayed', async () => {
    const diagnosis: HostDiagnosis = await service({ dataFolder: '/home/dev/.warpengine', configured: true }).diagnose()
    assert.deepEqual(diagnosis, { kind: 'notInstalled', dataFolder: '/home/dev/.warpengine', configured: true })
  })

  it('lists the stopped containers', async () => {
    const diagnosis: HostDiagnosis = await service({ containers: [engine('exited'), engine('running', 'warp-engine-local-gitea')] }).diagnose()
    assert.deepEqual(diagnosis, { kind: 'stopped', containers: ['warp-engine-local'] })
  })

  it('finds the engine at the port of its installation when the host names another', async () => {
    const diagnosis: HostDiagnosis = await service({ containers: [engine('running')], port: 7480, answering: ['http://127.0.0.1:7480'] }).diagnose()
    assert.deepEqual(diagnosis, { kind: 'elsewhere', url: 'http://127.0.0.1:7480' })
  })

  it('says when the engine runs but does not answer', async () => {
    assert.deepEqual(await service({ containers: [engine('running')] }).diagnose(), { kind: 'notAnswering', url: LOCAL })
  })

  it('waits for the host until the timeout', async () => {
    assert.equal(await service({}).waitForHost(10_000), false)
    assert.equal(await service({ answering: [LOCAL] }).waitForHost(10_000), true)
  })
})
