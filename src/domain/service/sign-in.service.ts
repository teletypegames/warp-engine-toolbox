/**
 * Signing in to a host with the device grant, and the stored sessions.
 *
 * @module
 */
import type { Principal } from '../model/catalog.model'
import { HostError } from '../model/host-error.model'
import { DomainError, msg } from '../model/message.model'
import { TOOL_SCOPES, type DeviceGrant, type Session, type TokenPoll } from '../model/sign-in.model'
import type { SessionRepository } from '../repository/session.repository'
import type { SignInRepository } from '../repository/sign-in.repository'
import type { ConnectionService } from './connection.service'

/** A pending device grant to wait for, with the means to cancel the wait. */
export interface Approval {
  /** The host URL. */
  readonly host: string
  /** The grant {@link SignInService.start} returned. */
  readonly grant: DeviceGrant
  /** Tells whether the user cancelled; checked before each poll. */
  readonly isCancelled: () => boolean
  /** Makes the error to throw when the user cancelled. */
  readonly cancelled: () => Error
}

const MIN_INTERVAL_SECONDS = 2

/** Runs the device sign-in flow against a host and keeps the resulting sessions in secret storage; the authentication provider is built on it. */
export class SignInService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the sign-in API of a host.
   * @param sessions - The stored sessions.
   */
  public constructor(private readonly connection: ConnectionService, private readonly sessions: SessionRepository) {}

  /**
   * Gives the scopes to ask for.
   *
   * @param requested - The scopes a caller asked for.
   * @returns The requested scopes, or the toolbox's admin scopes when none were asked for.
   */
  public scopes(requested: readonly string[]): readonly string[] {
    return requested.length > 0 ? requested : TOOL_SCOPES
  }

  /**
   * Starts a device grant on a host.
   *
   * @param host - The host URL.
   * @param clientName - The name shown on the approval page.
   * @param scopes - The scopes to ask for.
   * @returns The grant with the code for the user.
   */
  public async start(host: string, clientName: string, scopes: readonly string[]): Promise<DeviceGrant> {
    return this.connection.signIn(host).startDeviceGrant(clientName, scopes)
  }

  /**
   * Polls the host until the user approves the grant in the browser, at the grant's interval (at least two seconds).
   *
   * @param approval - The grant and the cancellation hooks.
   * @returns The admin token.
   * @throws {@link "domain/model/message.model".DomainError} When the user denies the grant or it expires.
   * @throws The error of `approval.cancelled` when the user cancels.
   */
  public async waitForApproval(approval: Approval): Promise<string> {
    const repository: SignInRepository = this.connection.signIn(approval.host)
    const deadline: number = Date.now() + approval.grant.expiresIn * 1000
    const interval: number = Math.max(approval.grant.interval, MIN_INTERVAL_SECONDS) * 1000
    while (Date.now() < deadline) {
      if (approval.isCancelled()) throw approval.cancelled()
      await new Promise((done: (value: unknown) => void) => setTimeout(done, interval))
      const answer: TokenPoll = await repository.pollDeviceGrant(approval.grant.deviceCode)
      if (answer.state === 'approved' && answer.token) return answer.token
      if (answer.state === 'denied') throw new DomainError(msg('The sign-in was denied.'), 'signIn')
      if (answer.state === 'expired') break
    }
    throw new DomainError(msg('The sign-in code expired.'), 'signIn')
  }

  /**
   * Stores a session for the first of several tokens the host takes, such as the local engine's token file and the
   * token its container gives.
   *
   * @param host - The host URL.
   * @param tokens - The tokens to try, in order.
   * @param scopes - The scopes to record when the host cannot be asked.
   * @returns The stored session.
   * @throws {@link "domain/model/message.model".DomainError} When the host refuses every token; its remedy is reinstalling the local engine.
   */
  public async createFirstSession(host: string, tokens: readonly string[], scopes: readonly string[]): Promise<Session> {
    for (const token of tokens) {
      try {
        return await this.createSession(host, token, scopes)
      } catch (error: unknown) {
        if (!HostError.isUnauthorized(error)) throw error
      }
    }
    throw new DomainError(msg('{0} refused every token found on this machine: run the local engine\'s installer again.', host), 'installLocalEngine')
  }

  /**
   * Stores a session for a token, replacing the earlier session of the same host; asks the host who the token belongs to for its label and scopes.
   *
   * @param host - The host URL.
   * @param token - The admin token.
   * @param scopes - The scopes to record when the host cannot be asked.
   * @returns The stored session.
   * @throws {@link domain/model/host-error.model!HostError} With 401, without storing anything, when the host refuses the token.
   */
  public async createSession(host: string, token: string, scopes: readonly string[]): Promise<Session> {
    const principal: Principal = await this.connection.signIn(host).principal(token)
      .catch((error: unknown): Principal => {
        if (HostError.isUnauthorized(error)) throw error
        return { label: null, scopes: [...scopes] }
      })
    const session: Session = { id: `${host}#${String(Date.now())}`, host, token, label: principal.label ?? host, scopes: principal.scopes }
    await this.sessions.save([...(await this.sessions.all()).filter((stored: Session) => stored.host !== host), session])
    return session
  }

  /**
   * Lists the stored sessions of a host.
   *
   * @param host - The host URL.
   * @returns The sessions; empty when signed out.
   */
  public async forHost(host: string): Promise<Session[]> {
    return (await this.sessions.all()).filter((session: Session) => session.host === host)
  }

  /**
   * Deletes a stored session.
   *
   * @param id - The session id.
   * @returns The removed session, or `null` when there was none of that id.
   */
  public async remove(id: string): Promise<Session | null> {
    const all: Session[] = await this.sessions.all()
    await this.sessions.save(all.filter((session: Session) => session.id !== id))
    return all.find((session: Session) => session.id === id) ?? null
  }
}
