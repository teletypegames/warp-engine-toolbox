/**
 * The device sign-in to a host and the stored sessions.
 *
 * @module
 */
/** The admin API scopes the toolbox asks for when signing in. */
export const TOOL_SCOPES: readonly string[] = ['admin:read', 'admin:write']

/** A device authorization the host granted: the code the user confirms in the browser while the toolbox polls for the token. */
export interface DeviceGrant {
  /** The code the toolbox polls the token with. */
  readonly deviceCode: string
  /** The code the user confirms in the browser. */
  readonly userCode: string
  /** The page where the user enters the code. */
  readonly verificationUrl: string
  /** The page with the code already filled in, which the toolbox opens. */
  readonly verificationUrlComplete: string
  /** The seconds to wait between polls. */
  readonly interval: number
  /** The seconds until the grant expires. */
  readonly expiresIn: number
  /** The scopes the token will have. */
  readonly scopes: readonly string[]
}

/** Where a device sign-in stands: still waiting, approved, denied by the user, or expired. */
export type TokenState = 'pending' | 'approved' | 'denied' | 'expired'

/** The answer to one poll for the token. */
export interface TokenPoll {
  /** Where the sign-in stands. */
  readonly state: TokenState
  /** The access token once approved, else `null`. */
  readonly token: string | null
}

/** A stored sign-in to a host. */
export interface Session {
  /** The session's id, made of the host and the sign-in time. */
  readonly id: string
  /** The host the token belongs to. */
  readonly host: string
  /** The access token. */
  readonly token: string
  /** The account name the host reported, or the host when it reported none. */
  readonly label: string
  /** The scopes the token has. */
  readonly scopes: readonly string[]
}
