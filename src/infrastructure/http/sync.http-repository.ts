import type { SyncCheck, SyncEvent, SyncPairing, SyncPeer, SyncPeerInput, SyncPush } from '../../domain/model/sync.model'
import type { SyncPairingRepository, SyncPeerRepository } from '../../domain/repository/sync.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

const ADMIN = '/api/admin/v1'

export class HttpSyncPeerRepository implements SyncPeerRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async peers(): Promise<SyncPeer[]> {
    return this.client.adminList<SyncPeer>('/sync_peers', { perPage: '200', sort: 'label' })
  }

  public async create(input: SyncPeerInput): Promise<SyncPeer> {
    return this.client.admin<SyncPeer>('POST', '/sync_peers', input)
  }

  public async update(id: number, changes: Partial<SyncPeerInput>): Promise<SyncPeer> {
    return this.client.admin<SyncPeer>('PATCH', `/sync_peers/${String(id)}`, changes)
  }

  public async remove(id: number): Promise<void> {
    await this.client.json<unknown>('DELETE', `${ADMIN}/sync_peers/${String(id)}`)
  }

  public async check(id: number): Promise<SyncCheck> {
    return this.client.admin<SyncCheck>('POST', `/sync_peers/${String(id)}/check`)
  }

  public async push(id: number): Promise<SyncPush> {
    return this.client.admin<SyncPush>('POST', `/sync_peers/${String(id)}/push`, {})
  }

  public async events(peerId: number, limit: number): Promise<SyncEvent[]> {
    return this.client.adminList<SyncEvent>('/sync_events', { syncPeerId: String(peerId), perPage: String(limit), sort: '-createdAt' })
  }
}

export class HttpSyncPairingRepository implements SyncPairingRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async pair(label: string): Promise<SyncPairing> {
    return this.client.admin<SyncPairing>('POST', '/sync_pairings', { label })
  }

  public async unpair(id: number): Promise<void> {
    await this.client.json<unknown>('DELETE', `${ADMIN}/sync_pairings/${String(id)}`)
  }
}
