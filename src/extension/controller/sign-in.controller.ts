/**
 * Signing in to and out of the current WarpEngine host.
 *
 * @packageDocumentation
 */

import type { Host } from '../../domain/model/host.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import type { RefreshController } from './refresh.controller'

/** Serves `warpengine.signIn`, `warpengine.signOut` and `warpengine.reauthorize`, and the sign-in that follows Set Host…. */
export class SignInController {
  /**
   * Creates the controller.
   *
   * @param connection - Gets a token, signing in when there is none.
   * @param auth - The authentication provider that holds the sessions.
   * @param refresh - Refreshes everything after the change.
   */
  public constructor(private readonly connection: ConnectionService, private readonly auth: WarpEngineAuthProvider, private readonly refresh: RefreshController) {}

  /** `warpengine.signIn`: signs in to the current host (the browser sign-in of the authentication provider), then refreshes everything. */
  public async signIn(): Promise<void> {
    await this.connection.token(true)
    await this.refresh.refresh()
  }

  /**
   * Signs in to a host just chosen with Set Host… when there is no session for it yet; does nothing otherwise.
   *
   * @param host - The host chosen, or `null` when the choice was cancelled.
   */
  public async signInTo(host: Host | null): Promise<void> {
    if (!host || (await this.connection.token(false)) !== null) return
    await this.signIn()
  }

  /** `warpengine.reauthorize`: drops the session the host refused and signs in again. */
  public async reauthorize(): Promise<void> {
    await this.auth.signOut()
    await this.signIn()
  }

  /** `warpengine.signOut`: removes the session of the current host and refreshes everything. */
  public async signOut(): Promise<void> {
    await this.auth.signOut()
    await this.refresh.refresh()
  }
}
