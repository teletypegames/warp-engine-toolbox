import type * as vscode from 'vscode'
import type { Session } from '../../domain/model/sign-in.model'
import type { SessionRepository } from '../../domain/repository/session.repository'

const STORE_KEY = 'warpengine.sessions'

export class SecretSessionRepository implements SessionRepository {
  public constructor(private readonly secrets: vscode.SecretStorage) {}

  public async all(): Promise<Session[]> {
    const raw: string | undefined = await this.secrets.get(STORE_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw) as Session[]
    } catch {
      return []
    }
  }

  public async save(sessions: readonly Session[]): Promise<void> {
    await this.secrets.store(STORE_KEY, JSON.stringify(sessions))
  }
}
