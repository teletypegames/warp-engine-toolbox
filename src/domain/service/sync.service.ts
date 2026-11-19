import type { Host } from '../model/host.model'
import type { LocalEngine, WellKnown } from '../model/local-engine.model'
import { DomainError, msg } from '../model/message.model'
import type { Session } from '../model/sign-in.model'
import { CHANNELS, SyncLink, type SyncCheck, type SyncEvent, type SyncPairing, type SyncPeer, type SyncPush } from '../model/sync.model'
import type { DiscoveryRepository } from '../repository/discovery.repository'
import type { SyncPeerRepository } from '../repository/sync.repository'
import type { AdminRepositories, WarpEngineGateway } from '../repository/warp-engine.gateway'
import type { HostService } from './host.service'
import type { LocalEngineService } from './local-engine.service'
import type { SignInService } from './sign-in.service'

export interface SyncTarget {
  readonly host: Host
  readonly info: WellKnown | null
  readonly pairable: boolean
  readonly signedIn: boolean
}

export interface Paired {
  readonly link: SyncLink
  readonly check: SyncCheck
}

export interface SyncServiceDependencies {
  readonly gateway: WarpEngineGateway
  readonly discovery: DiscoveryRepository
  readonly hosts: HostService
  readonly local: LocalEngineService
  readonly signIn: SignInService
}

const EVENTS_SHOWN = 20

export class SyncService {
  public constructor(private readonly deps: SyncServiceDependencies) {}

  public async targets(): Promise<SyncTarget[]> {
    const local: LocalEngine = this.requireLocal()
    const hosts: Host[] = this.deps.hosts.choices().filter((host: Host) => host.url !== local.url)
    return Promise.all(hosts.map(async (host: Host): Promise<SyncTarget> => {
      const info: WellKnown | null = await this.deps.discovery.probe(host.url)
      return { host, info, pairable: SyncLink.canPair(info), signedIn: (await this.session(host.url)) !== null }
    }))
  }

  public async links(): Promise<SyncLink[]> {
    if (!this.deps.local.current()) return []
    return (await (await this.localPeers()).peers())
      .filter((peer: SyncPeer) => peer.outboundEnabled && peer.transport === 'http')
      .map((peer: SyncPeer) => new SyncLink(peer))
  }

  public async pair(target: Host, channels: readonly string[], label: string): Promise<Paired> {
    const session: Session | null = await this.session(target.url)
    if (!session) throw new DomainError(msg('Sign in to {0} first.', target.name))
    const unknown: string[] = channels.filter((channel: string) => !CHANNELS.includes(channel))
    if (channels.length === 0 || unknown.length > 0) throw new DomainError(msg('Choose at least one channel of {0}.', CHANNELS.join(', ')))
    if ((await this.links()).some((link: SyncLink) => link.remoteUrl === target.url)) {
      throw new DomainError(msg('This engine syncs to {0} already.', target.name))
    }
    const remote: AdminRepositories = this.deps.gateway.admin(target.url, session.token)
    const pairing: SyncPairing = await remote.syncPairings.pair(label)
    if (!pairing.plainToken) throw new DomainError(msg('{0} paired but sent no token.', target.name))
    try {
      return await this.link(target, pairing, channels)
    } catch (error: unknown) {
      await remote.syncPairings.unpair(pairing.id).catch((): void => undefined)
      throw error
    }
  }

  public async events(link: SyncLink): Promise<SyncEvent[]> {
    return (await this.localPeers()).events(link.peer.id, EVENTS_SHOWN)
  }

  public async check(link: SyncLink): Promise<SyncCheck> {
    return (await this.localPeers()).check(link.peer.id)
  }

  public async pushNow(link: SyncLink): Promise<SyncPush> {
    return (await this.localPeers()).push(link.peer.id)
  }

  public async setChannels(link: SyncLink, channels: readonly string[]): Promise<SyncPeer> {
    if (channels.length === 0) throw new DomainError(msg('Choose at least one channel of {0}.', CHANNELS.join(', ')))
    return (await this.localPeers()).update(link.peer.id, { allowedChannels: channels })
  }

  public async disconnect(link: SyncLink): Promise<boolean> {
    await (await this.localPeers()).remove(link.peer.id)
    const session: Session | null = await this.session(link.remoteUrl)
    if (!session || link.pairingId === null) return false
    try {
      await this.deps.gateway.admin(link.remoteUrl, session.token).syncPairings.unpair(link.pairingId)
      return true
    } catch {
      return false
    }
  }

  private async link(target: Host, pairing: SyncPairing, channels: readonly string[]): Promise<Paired> {
    const peers: SyncPeerRepository = await this.localPeers()
    const peer: SyncPeer = await peers.create({
      label: target.name, transport: 'http', secret: pairing.plainToken ?? '', outboundEnabled: true, inboundEnabled: false,
      allowedChannels: channels,
      transportOptions: { host: SyncLink.fromContainer(target.url), remote: target.url, [SyncLink.PAIRING_OPTION]: pairing.id }
    })
    return { link: new SyncLink(peer), check: await peers.check(peer.id) }
  }

  private requireLocal(): LocalEngine {
    const local: LocalEngine | null = this.deps.local.current()
    if (!local) throw new DomainError(msg('No local WarpEngine is running: install one first ("WarpEngine: Install Local Engine").'))
    return local
  }

  private async localPeers(): Promise<SyncPeerRepository> {
    const local: LocalEngine = this.requireLocal()
    return this.deps.gateway.admin(local.url, await this.deps.local.token()).syncPeers
  }

  private async session(url: string): Promise<Session | null> {
    return (await this.deps.signIn.forHost(url))[0] ?? null
  }
}
