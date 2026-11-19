/**
 * The {@link domain/repository/sign-in.repository!SignInRepository} port implemented with the WarpEngine device grant.
 *
 * @module
 */
import type { Principal } from '../../domain/model/catalog.model'
import type { DeviceGrant, TokenPoll, TokenState } from '../../domain/model/sign-in.model'
import type { SignInRepository } from '../../domain/repository/sign-in.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * Signs in to a host with its device grant (`/api/auth/device`) and reads who a token belongs to.
 *
 * The requests throw a `WarpEngineError` when the host fails or cannot be reached.
 */
export class HttpSignInRepository implements SignInRepository {
  /**
   * Creates the repository.
   *
   * @param client - The client of the host, without a token.
   */
  public constructor(private readonly client: WarpEngineHttpClient) {}

  /**
   * Starts a device grant (`POST /api/auth/device`).
   *
   * @param clientName - The name the host shows on its approval page.
   * @param scopes - The scopes the token asks for.
   * @returns The grant: the user code, the approval URL and the device code to poll with.
   */
  public async startDeviceGrant(clientName: string, scopes: readonly string[]): Promise<DeviceGrant> {
    return this.client.json('POST', '/api/auth/device', { client_name: clientName, scopes })
  }

  /**
   * Asks once whether a device grant was approved (`POST /api/auth/device/token`).
   *
   * @param deviceCode - The device code of the grant.
   * @returns The grant's state, and the token once it is approved (`null` before).
   */
  public async pollDeviceGrant(deviceCode: string): Promise<TokenPoll> {
    const body: { state: TokenState; token?: string } = await this.client.json('POST', '/api/auth/device/token', { device_code: deviceCode })
    return { state: body.state, token: body.token ?? null }
  }

  /**
   * Reads who a token belongs to (`GET /api/admin/v1/me` with that token).
   *
   * @param token - The API token.
   * @returns The principal.
   */
  public async principal(token: string): Promise<Principal> {
    return this.client.withToken(token).admin<Principal>('GET', '/me')
  }
}
