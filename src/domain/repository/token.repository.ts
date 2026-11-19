/**
 * Port to the admin token of the signed-in session.
 *
 * @module
 */
/** Port to the admin token of the current host, from the VS Code authentication session. */
export interface TokenRepository {
  /**
   * Gets the admin token of the current session.
   *
   * @param createIfNone - `true` starts the sign-in flow when there is no session; `false` asks silently.
   * @returns The token, or `null` when there is no session (and none was created).
   */
  token(createIfNone: boolean): Promise<string | null>
}
