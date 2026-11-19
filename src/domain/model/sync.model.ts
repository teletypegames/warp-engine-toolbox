/**
 * Sync peers: other engines the host pushes releases to or receives them from.
 *
 * @module
 */
import type { WellKnown } from './local-engine.model'

/** Every release channel a sync peer can be limited to. */
export const CHANNELS: readonly string[] = ['stable', 'beta', 'dev']
/** The channels offered as selected when pairing a new peer. */
export const DEFAULT_CHANNELS: readonly string[] = ['stable', 'beta']

/** An engine the host pushes releases to or receives them from, as the admin API lists it. */
export interface SyncPeer {
  /** The peer's id. */
  readonly id: number
  /** The peer's name. */
  readonly label: string
  /** How releases travel, such as `http`. */
  readonly transport: string
  /** The transport's settings: `host` (as the engine reaches it), `remote` (as the toolbox reaches it) and the pairing id. */
  readonly transportOptions: Readonly<Record<string, unknown>>
  /** Whether releases are pushed to the peer. */
  readonly outboundEnabled: boolean
  /** Whether releases are accepted from the peer. */
  readonly inboundEnabled: boolean
  /** The channels synced; empty means all. */
  readonly allowedChannels: readonly string[]
  /** When the last sync finished, as an ISO 8601 timestamp. */
  readonly lastSyncedAt: string | null
  /** The error of the last sync, or `null`. */
  readonly lastError: string | null
}

/** What the toolbox sends to create a {@link SyncPeer}. */
export interface SyncPeerInput {
  /** The peer's name. */
  readonly label: string
  /** How releases travel, such as `http`. */
  readonly transport: string
  /** The transport's settings. */
  readonly transportOptions: Readonly<Record<string, unknown>>
  /** The token the peer issued at pairing, used to authenticate the pushes. */
  readonly secret: string
  /** Whether releases are pushed to the peer. */
  readonly outboundEnabled: boolean
  /** Whether releases are accepted from the peer. */
  readonly inboundEnabled: boolean
  /** The channels to sync; empty means all. */
  readonly allowedChannels: readonly string[]
}

/** A pairing the remote engine created for this one. */
export interface SyncPairing {
  /** The pairing's id on the remote engine. */
  readonly id: number
  /** The pairing's name. */
  readonly label: string
  /** The token in plain text, sent only once when the pairing is created. */
  readonly plainToken: string | null
}

/** The result of testing the connection to a peer. */
export interface SyncCheck {
  /** Whether the peer answered as expected. */
  readonly ok: boolean
  /** The HTTP status of the answer, if any. */
  readonly status: number | null
  /** The peer's WarpEngine version, if it said. */
  readonly version: string | null
  /** A description of the result. */
  readonly message: string
}

/** One step in a peer's sync log. */
export interface SyncEvent {
  /** The event's id. */
  readonly id: number
  /** Whether releases were going to the peer or coming from it. */
  readonly direction: 'outbound' | 'inbound'
  /** Where the step stands. */
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  /** The name of the step, if any. */
  readonly step: string | null
  /** The software the event is about, if any. */
  readonly softwareName: string | null
  /** The release version the event is about, if any. */
  readonly version: string | null
  /** A description of what happened, if any. */
  readonly message: string | null
  /** When the event happened, as an ISO 8601 timestamp. */
  readonly createdAt: string | null
}

/** The answer to a manual push to a peer. */
export interface SyncPush {
  /** How many releases were queued. */
  readonly queued: number
  /** The releases left out, with the reason. */
  readonly skipped: readonly string[]
}

/** A {@link SyncPeer} as the toolbox sees it: the pairing, the addresses and the channels read from its transport options. */
export class SyncLink {
  /** The transport option that holds the pairing id on the remote engine. */
  public static readonly PAIRING_OPTION: string = 'pairingId'
  private static readonly CONTAINER_HOST: string = 'host.docker.internal'
  private static readonly LOOPBACK: readonly string[] = ['127.0.0.1', 'localhost', '[::1]']

  /**
   * Wraps a peer.
   * @param peer - The peer as the host lists it.
   */
  public constructor(public readonly peer: SyncPeer) {}

  /** The peer's address as the engine reaches it (from inside its container), or `''`. */
  public get host(): string {
    const value: unknown = this.peer.transportOptions['host']
    return typeof value === 'string' ? value : ''
  }

  /** The pairing id on the remote engine, or `null` when the peer was not paired by the toolbox. */
  public get pairingId(): number | null {
    const value: unknown = this.peer.transportOptions[SyncLink.PAIRING_OPTION]
    return typeof value === 'number' ? value : null
  }

  /** The peer's address as the toolbox reaches it, falling back to {@link SyncLink.host}. */
  public get remoteUrl(): string {
    const value: unknown = this.peer.transportOptions['remote']
    return typeof value === 'string' && value ? value : this.host
  }

  /** The channels synced; all of {@link CHANNELS} when the peer allows every one. */
  public get channels(): readonly string[] {
    return this.peer.allowedChannels.length > 0 ? this.peer.allowedChannels : CHANNELS
  }

  /**
   * Tells whether an engine accepts pairing.
   * @param info - The engine's well-known information, or `null` when it could not be read.
   * @returns `true` when it accepts inbound sync and lists the `pairing` feature.
   */
  public static canPair(info: WellKnown | null): boolean {
    return info?.sync.inbound === true && (info.sync.features ?? []).includes('pairing')
  }

  /**
   * Rewrites a loopback URL so the local engine can reach it from inside its Docker container.
   * @param url - The URL as the toolbox reaches it.
   * @returns The URL with `127.0.0.1`, `localhost` or `[::1]` replaced by `host.docker.internal` and without a trailing slash; other URLs only lose the trailing slash, and an unparsable one is returned as it is.
   */
  public static fromContainer(url: string): string {
    try {
      const parsed: URL = new URL(url)
      if (!SyncLink.LOOPBACK.includes(parsed.hostname)) return url.replace(/\/+$/, '')
      parsed.hostname = SyncLink.CONTAINER_HOST
      return parsed.toString().replace(/\/+$/, '')
    } catch {
      return url
    }
  }
}
