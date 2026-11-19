/**
 * Syncing the local engine's releases to another WarpEngine.
 *
 * @module
 */
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

/** A host the local engine could sync to. */
export interface SyncTarget {
  /** The host. */
  readonly host: Host
  /** Its well-known document, or `null` when it did not answer. */
  readonly info: WellKnown | null
  /** Whether the host accepts pairing. */
  readonly pairable: boolean
  /** Whether there is a stored session for the host. */
  readonly signedIn: boolean
}

/** The outcome of {@link SyncService.pair}: the new link and its first connection check. */
export interface Paired {
  /** The link to the remote host. */
  readonly link: SyncLink
  /** The result of checking the new link. */
  readonly check: SyncCheck
}

/** What {@link SyncService} works with. */
export interface SyncServiceDependencies {
  /** Creates the admin repositories of the local and the remote engine. */
  readonly gateway: WarpEngineGateway
  /** Probes the candidate hosts. */
  readonly discovery: DiscoveryRepository
  /** Gives the host choices. */
  readonly hosts: HostService
  /** Finds the local engine and its token. */
  readonly local: LocalEngineService
  /** Gives the stored sessions of the remote hosts. */
  readonly signIn: SignInService
}

const EVENTS_SHOWN = 20

/**
 * Pairs the local engine with other WarpEngine hosts and manages the resulting links: the
 * local engine pushes the releases of the chosen channels to each.
 *
 * Members that use the local engine throw {@link "domain/model/message.model".DomainError} when none runs or its token is not
 * found; host errors reach the caller unchanged.
 */
export class SyncService {
  /**
   * Creates the service.
   *
   * @param deps - The gateway, discovery, hosts, local engine and sign-in services.
   */
  public constructor(private readonly deps: SyncServiceDependencies) {}

  /**
   * Lists the known hosts other than the local engine, probing each for whether it can pair and checking for a session.
   *
   * @returns The targets.
   * @throws {@link "domain/model/message.model".DomainError} When no local engine runs.
   */
  public async targets(): Promise<SyncTarget[]> {
    const local: LocalEngine = this.requireLocal()
    const hosts: Host[] = this.deps.hosts.choices().filter((host: Host) => host.url !== local.url)
    return Promise.all(hosts.map(async (host: Host): Promise<SyncTarget> => {
      const info: WellKnown | null = await this.deps.discovery.probe(host.url)
      return { host, info, pairable: SyncLink.canPair(info), signedIn: (await this.session(host.url)) !== null }
    }))
  }

  /**
   * Lists the targets that accept pairing.
   *
   * @returns The targets.
   * @throws {@link "domain/model/message.model".DomainError} When no local engine runs.
   */
  public async pairableTargets(): Promise<SyncTarget[]> {
    return (await this.targets()).filter((target: SyncTarget) => target.pairable)
  }

  /**
   * Tells whether there is a session for a host among the targets.
   *
   * @param host - The host.
   * @returns `true` when signed in to it.
   * @throws {@link "domain/model/message.model".DomainError} When no local engine runs.
   */
  public async isSignedInTo(host: Host): Promise<boolean> {
    return (await this.targets()).some((target: SyncTarget) => target.host.url === host.url && target.signedIn)
  }

  /**
   * Lists the outbound HTTP sync links of the local engine.
   *
   * @returns The links; empty without a local engine.
   */
  public async links(): Promise<SyncLink[]> {
    if (!this.deps.local.current()) return []
    return (await (await this.localPeers()).peers())
      .filter((peer: SyncPeer) => peer.outboundEnabled && peer.transport === 'http')
      .map((peer: SyncPeer) => new SyncLink(peer))
  }

  /**
   * Pairs the local engine with a remote host: creates a pairing on the remote (with the stored
   * session), adds the matching peer on the local engine, and checks the link. When adding the
   * peer fails, the remote pairing is withdrawn again.
   *
   * @param target - The remote host.
   * @param channels - The release channels to sync.
   * @param label - The label of the pairing on the remote.
   * @returns The link and its check.
   * @throws {@link "domain/model/message.model".DomainError} When not signed in to the target, the channels are empty or unknown, a link to it exists already, or the remote sends no token.
   */
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

  /**
   * Lists the latest 20 sync events of a link.
   *
   * @param link - The link.
   * @returns The events, newest first.
   */
  public async events(link: SyncLink): Promise<SyncEvent[]> {
    return (await this.localPeers()).events(link.peer.id, EVENTS_SHOWN)
  }

  /**
   * Has the local engine test a link.
   *
   * @param link - The link.
   * @returns The result of the check.
   */
  public async check(link: SyncLink): Promise<SyncCheck> {
    return (await this.localPeers()).check(link.peer.id)
  }

  /**
   * Has the local engine push its releases over a link now.
   *
   * @param link - The link.
   * @returns What the push started or sent.
   */
  public async pushNow(link: SyncLink): Promise<SyncPush> {
    return (await this.localPeers()).push(link.peer.id)
  }

  /**
   * Changes the release channels a link syncs.
   *
   * @param link - The link.
   * @param channels - The channels.
   * @returns The updated peer.
   * @throws {@link "domain/model/message.model".DomainError} When no channel is given.
   */
  public async setChannels(link: SyncLink, channels: readonly string[]): Promise<SyncPeer> {
    if (channels.length === 0) throw new DomainError(msg('Choose at least one channel of {0}.', CHANNELS.join(', ')))
    return (await this.localPeers()).update(link.peer.id, { allowedChannels: channels })
  }

  /**
   * Removes a link from the local engine and, when signed in to the remote, withdraws its pairing there too.
   *
   * @param link - The link.
   * @returns `true` when the remote pairing was withdrawn as well.
   */
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
