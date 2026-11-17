import type { Principal } from '../model/catalog.model'
import type { DeviceGrant, TokenPoll } from '../model/sign-in.model'

export interface SignInRepository {
  startDeviceGrant(clientName: string, scopes: readonly string[]): Promise<DeviceGrant>
  pollDeviceGrant(deviceCode: string): Promise<TokenPoll>
  principal(token: string): Promise<Principal>
}
