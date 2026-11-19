/**
 * Port to the stored sign-in sessions.
 *
 * @module
 */
import type { Session } from '../model/sign-in.model'

/** Port to the sign-in sessions kept in secret storage. */
export interface SessionRepository {
  /**
   * Reads every stored session.
   *
   * @returns The sessions; empty when none is stored or the store is unreadable.
   */
  all(): Promise<Session[]>
  /**
   * Stores the sessions, replacing every earlier one.
   *
   * @param sessions - The complete list.
   */
  save(sessions: readonly Session[]): Promise<void>
}
