export const TOOL_SCOPES: readonly string[] = ['admin:read', 'admin:write']

export interface DeviceGrant {
  readonly deviceCode: string
  readonly userCode: string
  readonly verificationUrl: string
  readonly verificationUrlComplete: string
  readonly interval: number
  readonly expiresIn: number
  readonly scopes: readonly string[]
}

export type TokenState = 'pending' | 'approved' | 'denied' | 'expired'

export interface TokenPoll {
  readonly state: TokenState
  readonly token: string | null
}

export interface Session {
  readonly id: string
  readonly host: string
  readonly token: string
  readonly label: string
  readonly scopes: readonly string[]
}
