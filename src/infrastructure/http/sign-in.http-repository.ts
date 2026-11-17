import type { Principal } from '../../domain/model/catalog.model'
import type { DeviceGrant, TokenPoll, TokenState } from '../../domain/model/sign-in.model'
import type { SignInRepository } from '../../domain/repository/sign-in.repository'
import type { WarpEngineHttpClient } from './warp-engine.http-client'

export class HttpSignInRepository implements SignInRepository {
  public constructor(private readonly client: WarpEngineHttpClient) {}

  public async startDeviceGrant(clientName: string, scopes: readonly string[]): Promise<DeviceGrant> {
    return this.client.json('POST', '/api/auth/device', { client_name: clientName, scopes })
  }

  public async pollDeviceGrant(deviceCode: string): Promise<TokenPoll> {
    const body: { state: TokenState; token?: string } = await this.client.json('POST', '/api/auth/device/token', { device_code: deviceCode })
    return { state: body.state, token: body.token ?? null }
  }

  public async principal(token: string): Promise<Principal> {
    return this.client.withToken(token).admin<Principal>('GET', '/me')
  }
}
