/**
 * The {@link domain/repository/session.repository!SessionRepository} port implemented with the VS Code secret storage.
 *
 * @module
 */
import type * as vscode from 'vscode'
import type { Session } from '../../domain/model/sign-in.model'
import type { SessionRepository } from '../../domain/repository/session.repository'

const STORE_KEY = 'warpengine.sessions'

/**
 * Keeps every signed-in session, tokens included, as one JSON array under the
 * `warpengine.sessions` secret.
 */
export class SecretSessionRepository implements SessionRepository {
  /**
   * Creates the repository.
   *
   * @param secrets - The extension's secret storage.
   */
  public constructor(private readonly secrets: vscode.SecretStorage) {}

  /**
   * Reads the stored sessions.
   *
   * @returns The sessions; an empty list when none are stored or the secret is not valid JSON.
   */
  public async all(): Promise<Session[]> {
    const raw: string | undefined = await this.secrets.get(STORE_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw) as Session[]
    } catch {
      return []
    }
  }

  /**
   * Replaces the stored sessions.
   *
   * @param sessions - The full list to keep.
   */
  public async save(sessions: readonly Session[]): Promise<void> {
    await this.secrets.store(STORE_KEY, JSON.stringify(sessions))
  }
}
