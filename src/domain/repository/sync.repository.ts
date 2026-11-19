import type { SyncCheck, SyncEvent, SyncPairing, SyncPeer, SyncPeerInput, SyncPush } from '../model/sync.model'

export interface SyncPeerRepository {
  peers(): Promise<SyncPeer[]>
  create(input: SyncPeerInput): Promise<SyncPeer>
  update(id: number, changes: Partial<SyncPeerInput>): Promise<SyncPeer>
  remove(id: number): Promise<void>
  check(id: number): Promise<SyncCheck>
  push(id: number): Promise<SyncPush>
  events(peerId: number, limit: number): Promise<SyncEvent[]>
}

export interface SyncPairingRepository {
  pair(label: string): Promise<SyncPairing>
  unpair(id: number): Promise<void>
}
