import type { Session } from '../model/sign-in.model'

export interface SessionRepository {
  all(): Promise<Session[]>
  save(sessions: readonly Session[]): Promise<void>
}
