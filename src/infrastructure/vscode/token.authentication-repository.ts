/**
 * The {@link domain/repository/token.repository!TokenRepository} port implemented with the VS Code authentication API.
 *
 * @module
 */
import * as vscode from 'vscode'
import { TOOL_SCOPES } from '../../domain/model/sign-in.model'
import type { TokenRepository } from '../../domain/repository/token.repository'

/**
 * Gets the API token from the session of an authentication provider, with the {@link domain/model/sign-in.model!TOOL_SCOPES}.
 */
export class AuthenticationTokenRepository implements TokenRepository {
  /**
   * Creates the repository.
   *
   * @param providerId - The id of the authentication provider, the toolbox's own.
   */
  public constructor(private readonly providerId: string) {}

  /**
   * Reads the access token of the provider's session (`vscode.authentication.getSession`).
   *
   * @param createIfNone - `true` signs in when there is no session, which shows VS Code's sign-in
   *   prompt and the provider's flow; `false` asks silently.
   * @returns The token, or `null` when there is no session.
   * @throws When the user cancels a sign-in that `createIfNone` started.
   */
  public async token(createIfNone: boolean): Promise<string | null> {
    const options: vscode.AuthenticationGetSessionOptions = createIfNone ? { createIfNone: true } : { silent: true }
    const session: vscode.AuthenticationSession | undefined = await vscode.authentication.getSession(this.providerId, [...TOOL_SCOPES], options)
    return session?.accessToken ?? null
  }
}
