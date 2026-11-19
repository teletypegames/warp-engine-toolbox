import type { WellKnown } from './local-engine.model'

export const CHANNELS: readonly string[] = ['stable', 'beta', 'dev']
export const DEFAULT_CHANNELS: readonly string[] = ['stable', 'beta']

export interface SyncPeer {
  readonly id: number
  readonly label: string
  readonly transport: string
  readonly transportOptions: Readonly<Record<string, unknown>>
  readonly outboundEnabled: boolean
  readonly inboundEnabled: boolean
  readonly allowedChannels: readonly string[]
  readonly lastSyncedAt: string | null
  readonly lastError: string | null
}

export interface SyncPeerInput {
  readonly label: string
  readonly transport: string
  readonly transportOptions: Readonly<Record<string, unknown>>
  readonly secret: string
  readonly outboundEnabled: boolean
  readonly inboundEnabled: boolean
  readonly allowedChannels: readonly string[]
}

export interface SyncPairing {
  readonly id: number
  readonly label: string
  readonly plainToken: string | null
}

export interface SyncCheck {
  readonly ok: boolean
  readonly status: number | null
  readonly version: string | null
  readonly message: string
}

export interface SyncEvent {
  readonly id: number
  readonly direction: 'outbound' | 'inbound'
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
  readonly step: string | null
  readonly softwareName: string | null
  readonly version: string | null
  readonly message: string | null
  readonly createdAt: string | null
}

export interface SyncPush {
  readonly queued: number
  readonly skipped: readonly string[]
}

export class SyncLink {
  public static readonly PAIRING_OPTION: string = 'pairingId'
  private static readonly CONTAINER_HOST: string = 'host.docker.internal'
  private static readonly LOOPBACK: readonly string[] = ['127.0.0.1', 'localhost', '[::1]']

  public constructor(public readonly peer: SyncPeer) {}

  public get host(): string {
    const value: unknown = this.peer.transportOptions['host']
    return typeof value === 'string' ? value : ''
  }

  public get pairingId(): number | null {
    const value: unknown = this.peer.transportOptions[SyncLink.PAIRING_OPTION]
    return typeof value === 'number' ? value : null
  }

  public get remoteUrl(): string {
    const value: unknown = this.peer.transportOptions['remote']
    return typeof value === 'string' && value ? value : this.host
  }

  public get channels(): readonly string[] {
    return this.peer.allowedChannels.length > 0 ? this.peer.allowedChannels : CHANNELS
  }

  public static canPair(info: WellKnown | null): boolean {
    return info?.sync.inbound === true && (info.sync.features ?? []).includes('pairing')
  }

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
