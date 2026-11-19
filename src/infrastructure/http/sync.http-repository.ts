/**
 * The sync ports, {@link domain/repository/sync.repository!SyncPeerRepository} and {@link domain/repository/sync.repository!SyncPairingRepository}, implemented on the WarpEngine admin API.
 *
 * @module
 */
import type { SyncCheck, SyncEvent, SyncPairing, SyncPeer, SyncPeerInput, SyncPush } from '../../domain/model/sync.model'
import type { SyncPairingRepository, SyncPeerRepository } from '../../domain/repository/sync.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

const ADMIN = '/api/admin/v1'

/**
 * The sync peers of a host (the other engines it sends releases to) over `/api/admin/v1/sync_peers`.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpSyncPeerRepository implements SyncPeerRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Lists the peers by label, up to 200 (`GET /api/admin/v1/sync_peers`).
   *
   * @returns The peers.
   */
  public async peers(): Promise<SyncPeer[]> {
    return this.client.adminList<SyncPeer>('/sync_peers', { perPage: '200', sort: 'label' })
  }

  /**
   * Adds a peer (`POST /api/admin/v1/sync_peers`).
   *
   * @param input - The peer's settings.
   * @returns The created peer.
   */
  public async create(input: SyncPeerInput): Promise<SyncPeer> {
    return this.client.admin<SyncPeer>('POST', '/sync_peers', input)
  }

  /**
   * Changes a peer's settings (`PATCH /api/admin/v1/sync_peers/:id`).
   *
   * @param id - The peer id.
   * @param changes - The settings to change.
   * @returns The updated peer.
   */
  public async update(id: number, changes: Partial<SyncPeerInput>): Promise<SyncPeer> {
    return this.client.admin<SyncPeer>('PATCH', `/sync_peers/${String(id)}`, changes)
  }

  /**
   * Deletes a peer (`DELETE /api/admin/v1/sync_peers/:id`).
   *
   * @param id - The peer id.
   */
  public async remove(id: number): Promise<void> {
    await this.client.json<unknown>('DELETE', `${ADMIN}/sync_peers/${String(id)}`)
  }

  /**
   * Has the host test its connection to a peer (`POST /api/admin/v1/sync_peers/:id/check`).
   *
   * @param id - The peer id.
   * @returns The result of the check.
   */
  public async check(id: number): Promise<SyncCheck> {
    return this.client.admin<SyncCheck>('POST', `/sync_peers/${String(id)}/check`)
  }

  /**
   * Has the host send to a peer now (`POST /api/admin/v1/sync_peers/:id/push`).
   *
   * @param id - The peer id.
   * @returns What the push started.
   */
  public async push(id: number): Promise<SyncPush> {
    return this.client.admin<SyncPush>('POST', `/sync_peers/${String(id)}/push`, {})
  }

  /**
   * Lists the latest sync events of a peer, newest first (`GET /api/admin/v1/sync_events`).
   *
   * @param peerId - The peer id.
   * @param limit - The most events to return.
   * @returns The events.
   */
  public async events(peerId: number, limit: number): Promise<SyncEvent[]> {
    return this.client.adminList<SyncEvent>('/sync_events', { syncPeerId: String(peerId), perPage: String(limit), sort: '-createdAt' })
  }
}

/**
 * The pairings of a host (the receiving side of a sync) over `/api/admin/v1/sync_pairings`.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpSyncPairingRepository implements SyncPairingRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, with an administrator's token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Creates a pairing the sending engine can use (`POST /api/admin/v1/sync_pairings`).
   *
   * @param label - The name of the pairing on this host.
   * @returns The pairing with its credentials.
   */
  public async pair(label: string): Promise<SyncPairing> {
    return this.client.admin<SyncPairing>('POST', '/sync_pairings', { label })
  }

  /**
   * Deletes a pairing (`DELETE /api/admin/v1/sync_pairings/:id`).
   *
   * @param id - The pairing id.
   */
  public async unpair(id: number): Promise<void> {
    await this.client.json<unknown>('DELETE', `${ADMIN}/sync_pairings/${String(id)}`)
  }
}
