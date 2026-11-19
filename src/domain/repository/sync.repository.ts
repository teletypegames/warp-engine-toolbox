/**
 * Ports to the synchronisation between two WarpEngine hosts.
 *
 * @module
 */
import type { SyncCheck, SyncEvent, SyncPairing, SyncPeer, SyncPeerInput, SyncPush } from '../model/sync.model'

/**
 * Port to the sync peers of a host (the engines it pushes releases to or receives them from), through its admin API.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface SyncPeerRepository {
  /**
   * Lists the peers, sorted by label.
   *
   * @returns The peers, at most one page of 200.
   */
  peers(): Promise<SyncPeer[]>
  /**
   * Adds a peer.
   *
   * @param input - The peer's URL, label, direction and settings.
   * @returns The created peer.
   */
  create(input: SyncPeerInput): Promise<SyncPeer>
  /**
   * Changes a peer.
   *
   * @param id - The peer id.
   * @param changes - The fields to change.
   * @returns The peer as the host stored it.
   */
  update(id: number, changes: Partial<SyncPeerInput>): Promise<SyncPeer>
  /**
   * Deletes a peer.
   *
   * @param id - The peer id.
   */
  remove(id: number): Promise<void>
  /**
   * Has the host test the connection to a peer.
   *
   * @param id - The peer id.
   * @returns The result of the check.
   */
  check(id: number): Promise<SyncCheck>
  /**
   * Has the host push its releases to a peer now.
   *
   * @param id - The peer id.
   * @returns What the push started or sent.
   */
  push(id: number): Promise<SyncPush>
  /**
   * Lists the latest sync events of a peer, newest first.
   *
   * @param peerId - The peer id.
   * @param limit - The most events to return.
   * @returns The events.
   */
  events(peerId: number, limit: number): Promise<SyncEvent[]>
}

/**
 * Port to the pairings of a host: one-time offers another engine uses to connect as a peer.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface SyncPairingRepository {
  /**
   * Creates a pairing offer.
   *
   * @param label - The label the offer is shown with.
   * @returns The pairing with what the other engine needs to connect.
   */
  pair(label: string): Promise<SyncPairing>
  /**
   * Withdraws a pairing.
   *
   * @param id - The pairing id.
   */
  unpair(id: number): Promise<void>
}
