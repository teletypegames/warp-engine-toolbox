import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Host } from '../../../../src/domain/model/host.model'
import type { WellKnown } from '../../../../src/domain/model/local-engine.model'
import { DomainError } from '../../../../src/domain/model/message.model'
import type { Session } from '../../../../src/domain/model/sign-in.model'
import { SyncLink, type SyncCheck, type SyncEvent, type SyncPairing, type SyncPeer, type SyncPeerInput, type SyncPush } from '../../../../src/domain/model/sync.model'
import type { HostRepository } from '../../../../src/domain/repository/host.repository'
import type { SessionRepository } from '../../../../src/domain/repository/session.repository'
import type { SyncPairingRepository, SyncPeerRepository } from '../../../../src/domain/repository/sync.repository'
import type { AdminRepositories, WarpEngineGateway } from '../../../../src/domain/repository/warp-engine.gateway'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import { HostService } from '../../../../src/domain/service/host.service'
import { LocalEngineService } from '../../../../src/domain/service/local-engine.service'
import { SignInService } from '../../../../src/domain/service/sign-in.service'
import { SyncService } from '../../../../src/domain/service/sync.service'

const LOCAL = 'http://127.0.0.1:7470'
const REMOTE = 'https://games.example.org'
const SANDBOX = 'http://localhost:8081'

function wellKnown(profile: 'local' | 'server', inbound: boolean, features: string[] = ['pairing']): WellKnown {
  return { engine: 'warp-engine', version: '5.3.0', api: 2, name: profile, profile, signIn: [], adminApi: '/api/admin/v2', admin: false,
           sync: { inbound, target: null, pairing: inbound ? 'anyone' : null, features } }
}

class MemoryHosts implements HostRepository {
  public url = ''
  public hosts: Host[] = []
  public configuredUrl(): string { return this.url }
  public configuredHosts(): Host[] { return this.hosts }
  public async saveUrl(url: string): Promise<void> { this.url = url; return Promise.resolve() }
  public async saveHosts(hosts: readonly Host[]): Promise<void> { this.hosts = [...hosts]; return Promise.resolve() }
}

class LocalPeers implements SyncPeerRepository {
  public list: SyncPeer[] = []
  public failCreate = false
  public async peers(): Promise<SyncPeer[]> { return Promise.resolve(this.list) }
  public async create(input: SyncPeerInput): Promise<SyncPeer> {
    if (this.failCreate) return Promise.reject(new Error('local refused'))
    const peer: SyncPeer = { id: this.list.length + 1, label: input.label, transport: input.transport, transportOptions: input.transportOptions,
                             outboundEnabled: input.outboundEnabled, inboundEnabled: input.inboundEnabled, allowedChannels: input.allowedChannels,
                             lastSyncedAt: null, lastError: null }
    this.list.push(peer)
    return Promise.resolve(peer)
  }
  public async update(id: number, changes: Partial<SyncPeerInput>): Promise<SyncPeer> {
    const found: SyncPeer | undefined = this.list.find((item: SyncPeer) => item.id === id)
    return found ? Promise.resolve({ ...found, ...changes }) : Promise.reject(new Error('no peer'))
  }
  public async remove(id: number): Promise<void> { this.list = this.list.filter((peer: SyncPeer) => peer.id !== id); return Promise.resolve() }
  public async check(): Promise<SyncCheck> { return Promise.resolve({ ok: true, status: 400, version: '5.3.0', message: 'the token is accepted' }) }
  public async push(): Promise<SyncPush> { return Promise.resolve({ queued: 1, skipped: [] }) }
  public async events(): Promise<SyncEvent[]> { return Promise.resolve([]) }
}

class RemotePairings implements SyncPairingRepository {
  public paired: string[] = []
  public unpaired: number[] = []
  public async pair(label: string): Promise<SyncPairing> { this.paired.push(label); return Promise.resolve({ id: 7, label, plainToken: 'remote-token' }) }
  public async unpair(id: number): Promise<void> { this.unpaired.push(id); return Promise.resolve() }
}

interface World {
  readonly service: SyncService
  readonly peers: LocalPeers
  readonly pairings: RemotePairings
  readonly tokens: Record<string, string>
}

async function world(sessions: Session[] = [{ id: 's', host: REMOTE, token: 'remote-session', label: 'me', scopes: ['admin:write'] }]): Promise<World> {
  const repository: MemoryHosts = new MemoryHosts()
  repository.hosts = [{ name: 'games.example.org', url: REMOTE }, { name: 'old.example', url: 'https://old.example' }, { name: 'sandbox', url: SANDBOX }]
  const hosts: HostService = new HostService(repository)
  const answers: Record<string, WellKnown> = { [LOCAL]: wellKnown('local', false), [REMOTE]: wellKnown('server', true), [SANDBOX]: wellKnown('server', true),
                                               'https://old.example': wellKnown('server', true, []) }
  const discovery = { probe: async (url: string): Promise<WellKnown | null> => Promise.resolve(answers[url] ?? null) }
  const local: LocalEngineService = new LocalEngineService(discovery, { port: async () => Promise.resolve(null), tokenFile: async () => Promise.resolve('local-token'), tokenFromContainer: async () => Promise.resolve(null), dataFolder: async () => Promise.resolve(null), configured: async () => Promise.resolve(false) }, hosts)
  await local.discover()
  const peers: LocalPeers = new LocalPeers()
  const pairings: RemotePairings = new RemotePairings()
  const tokens: Record<string, string> = {}
  const gateway: WarpEngineGateway = {
    build: () => { throw new Error('unused') },
    publicCatalog: () => { throw new Error('unused') },
    signIn: () => { throw new Error('unused') },
    admin: (url: string, token: string): AdminRepositories => {
      tokens[url] = token
      return { syncPeers: peers, syncPairings: pairings } as unknown as AdminRepositories
    }
  }
  const store: SessionRepository = { all: async () => Promise.resolve(sessions), save: async () => Promise.resolve() }
  const signIn: SignInService = new SignInService(null as unknown as ConnectionService, store)
  return { service: new SyncService({ gateway, discovery, hosts, local, signIn }), peers, pairings, tokens }
}

describe('SyncService', () => {
  it('offers the known engines that take pairing, and tells which need a sign-in', async () => {
    const { service } = await world()

    const targets = await service.targets()

    assert.deepEqual(targets.map((target) => [target.host.url, target.pairable, target.signedIn]),
                     [[REMOTE, true, true], ['https://old.example', false, false], [SANDBOX, true, false]])
    assert.deepEqual((await service.pairableTargets()).map((target) => target.host.url), [REMOTE, SANDBOX])
    assert.equal(await service.isSignedInTo({ name: 'Studio', url: REMOTE }), true)
    assert.equal(await service.isSignedInTo({ name: 'Sandbox', url: SANDBOX }), false)
  })

  it('pairs on the remote engine, then adds the outbound peer here with its token, the channels and the way back', async () => {
    const { service, peers, pairings, tokens } = await world()

    const paired = await service.pair({ name: 'Studio', url: REMOTE }, ['stable'], 'laptop local')

    assert.deepEqual(pairings.paired, ['laptop local'])
    assert.equal(tokens[REMOTE], 'remote-session')
    assert.equal(tokens[LOCAL], 'local-token')
    assert.equal(paired.check.ok, true)
    const peer: SyncPeer | undefined = peers.list[0]
    assert.ok(peer)
    assert.deepEqual(peer.allowedChannels, ['stable'])
    assert.equal(paired.link.host, REMOTE)
    assert.equal(paired.link.pairingId, 7)
    assert.equal(paired.link.remoteUrl, REMOTE)
  })

  it('reaches an engine on this machine from the container through host.docker.internal', () => {
    assert.equal(SyncLink.fromContainer('http://localhost:8081/'), 'http://host.docker.internal:8081')
    assert.equal(SyncLink.fromContainer('http://127.0.0.1:8081'), 'http://host.docker.internal:8081')
    assert.equal(SyncLink.fromContainer('https://games.example.org'), 'https://games.example.org')
  })

  it('undoes the remote pairing when the local engine refuses the peer', async () => {
    const { service, peers, pairings } = await world()
    peers.failCreate = true

    await assert.rejects(service.pair({ name: 'Studio', url: REMOTE }, ['stable'], 'laptop'), /local refused/)
    assert.deepEqual(pairings.unpaired, [7])
  })

  it('wants a sign-in, a channel, and no second pairing with the same engine', async () => {
    const { service } = await world()

    await assert.rejects(service.pair({ name: 'sandbox', url: SANDBOX }, ['stable'], 'x'), DomainError)
    await assert.rejects(service.pair({ name: 'Studio', url: REMOTE }, [], 'x'), DomainError)
    await service.pair({ name: 'Studio', url: REMOTE }, ['stable'], 'x')
    await assert.rejects(service.pair({ name: 'Studio', url: REMOTE }, ['stable'], 'x'), DomainError)
  })

  it('disconnects here and removes the pairing there', async () => {
    const { service, peers, pairings } = await world()
    const paired = await service.pair({ name: 'Studio', url: REMOTE }, ['stable', 'beta'], 'x')

    assert.equal(await service.disconnect(paired.link), true)
    assert.deepEqual(peers.list, [])
    assert.deepEqual(pairings.unpaired, [7])
  })
})
