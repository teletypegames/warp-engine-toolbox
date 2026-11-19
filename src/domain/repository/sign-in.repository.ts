/**
 * Port to the device sign-in flow of a host.
 *
 * @module
 */
import type { Principal } from '../model/catalog.model'
import type { DeviceGrant, TokenPoll } from '../model/sign-in.model'

/**
 * Port to the OAuth-style device grant of a WarpEngine host, which yields an admin token.
 *
 * Every member rejects with a {@link "domain/model/host-error.model".HostError} when the host answers with an error.
 */
export interface SignInRepository {
  /**
   * Starts a device grant: the host hands out a code for the user to approve in the browser.
   *
   * @param clientName - The name the host shows on the approval page.
   * @param scopes - The scopes the token asks for.
   * @returns The device code, the user code and where to approve it.
   */
  startDeviceGrant(clientName: string, scopes: readonly string[]): Promise<DeviceGrant>
  /**
   * Asks whether the user has approved a device grant yet.
   *
   * @param deviceCode - The device code from {@link SignInRepository.startDeviceGrant}.
   * @returns The state of the grant, with the token once approved.
   */
  pollDeviceGrant(deviceCode: string): Promise<TokenPoll>
  /**
   * Fetches who a token belongs to.
   *
   * @param token - The admin token.
   * @returns The principal of the token.
   */
  principal(token: string): Promise<Principal>
}
