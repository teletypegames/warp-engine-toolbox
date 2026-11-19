import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Host } from '../../../../src/domain/model/host.model'
import { LocalEngine, type WellKnown } from '../../../../src/domain/model/local-engine.model'
import { DomainError } from '../../../../src/domain/model/message.model'
import type { DiscoveryRepository } from '../../../../src/domain/repository/discovery.repository'
import type { HostRepository } from '../../../../src/domain/repository/host.repository'
import type { LocalEngineRepository } from '../../../../src/domain/repository/local-engine.repository'
import { HostService } from '../../../../src/domain/service/host.service'
import { LocalEngineService } from '../../../../src/domain/service/local-engine.service'

function wellKnown(profile: 'local' | 'server'): WellKnown {
  return { engine: 'warp-engine', version: '5.2.0', api: 2, name: 'Local', profile, signIn: ['token-file'], adminApi: '/api/admin/v1',
           admin: false, sync: { inbound: false, target: 'https://games.example.org' } }
}

class MemoryHosts implements HostRepository {
  public url = ''
  public hosts: Host[] = []
  public configuredUrl(): string { return this.url }
  public configuredHosts(): Host[] { return this.hosts }
  public async saveUrl(url: string): Promise<void> { this.url = url; return Promise.resolve() }
  public async saveHosts(hosts: readonly Host[]): Promise<void> { this.hosts = [...hosts]; return Promise.resolve() }
}

function local(port: number | null, file: string | null, container: string | null = null): LocalEngineRepository {
  return {
    port: async () => Promise.resolve(port),
    tokenFile: async () => Promise.resolve(file),
    tokenFromContainer: async () => Promise.resolve(container)
  }
}

type Probe = DiscoveryRepository & { probed: string[] }

function discovery(answers: Record<string, WellKnown>): Probe {
  const probed: string[] = []
  return { probed, probe: async (url: string): Promise<WellKnown | null> => { probed.push(url); return Promise.resolve(answers[url] ?? null) } }
}

describe('LocalEngineService', () => {
  it('finds a local engine on the default port, lists it and makes it the host when none is set', async () => {
    const repository: MemoryHosts = new MemoryHosts()
    const hosts: HostService = new HostService(repository)
    const probe: Probe = discovery({ 'http://127.0.0.1:7470': wellKnown('local') })
    const service: LocalEngineService = new LocalEngineService(probe, local(null, 'tok'), hosts)

    const found: LocalEngine | null = await service.discover()

    assert.ok(found)
    assert.deepEqual(probe.probed, ['http://127.0.0.1:7470'])
    assert.equal(found.syncTarget, 'https://games.example.org')
    assert.equal(repository.url, 'http://127.0.0.1:7470')
    assert.deepEqual(hosts.choices().map((host: Host) => host.name), ['Local (5.2.0)'])
    assert.ok(service.isLocal('http://127.0.0.1:7470'))
    assert.ok(service.isCurrentHost())
    assert.equal(await service.token(), 'tok')
  })

  it('probes the saved port and keeps a host the developer chose', async () => {
    const repository: MemoryHosts = new MemoryHosts()
    repository.url = 'https://games.example'
    const hosts: HostService = new HostService(repository)
    const service: LocalEngineService = new LocalEngineService(discovery({ 'http://127.0.0.1:7471': wellKnown('local') }), local(7471, null, 'from-container'), hosts)

    assert.ok(await service.discover())
    assert.equal(repository.url, 'https://games.example')
    assert.deepEqual(hosts.choices().map((host: Host) => host.url), ['https://games.example', 'http://127.0.0.1:7471'])
    assert.equal(await service.token(), 'from-container')
  })

  it('takes a server engine on the port for no local engine, and forgets one that went away', async () => {
    const hosts: HostService = new HostService(new MemoryHosts())
    const answers: Record<string, WellKnown> = { 'http://127.0.0.1:7470': wellKnown('server') }
    const service: LocalEngineService = new LocalEngineService(discovery(answers), local(null, null), hosts)

    assert.equal(await service.discover(), null)
    assert.deepEqual(hosts.choices(), [])
    await assert.rejects(service.token(), DomainError)
  })

  it('recognises a well-known answer', () => {
    assert.ok(LocalEngine.isWellKnown(wellKnown('local')))
    assert.ok(!LocalEngine.isWellKnown({ engine: 'other', version: '1', profile: 'local' }))
    assert.ok(!LocalEngine.isWellKnown(null))
  })
})
