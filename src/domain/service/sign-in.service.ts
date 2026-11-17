import type { Principal } from '../model/catalog.model'
import { DomainError, msg } from '../model/message.model'
import { TOOL_SCOPES, type DeviceGrant, type Session, type TokenPoll } from '../model/sign-in.model'
import type { SessionRepository } from '../repository/session.repository'
import type { SignInRepository } from '../repository/sign-in.repository'
import type { ConnectionService } from './connection.service'

export interface Approval {
  readonly host: string
  readonly grant: DeviceGrant
  readonly isCancelled: () => boolean
  readonly cancelled: () => Error
}

const MIN_INTERVAL_SECONDS = 2

export class SignInService {
  public constructor(private readonly connection: ConnectionService, private readonly sessions: SessionRepository) {}

  public scopes(requested: readonly string[]): readonly string[] {
    return requested.length > 0 ? requested : TOOL_SCOPES
  }

  public async start(host: string, clientName: string, scopes: readonly string[]): Promise<DeviceGrant> {
    return this.connection.signIn(host).startDeviceGrant(clientName, scopes)
  }

  public async waitForApproval(approval: Approval): Promise<string> {
    const repository: SignInRepository = this.connection.signIn(approval.host)
    const deadline: number = Date.now() + approval.grant.expiresIn * 1000
    const interval: number = Math.max(approval.grant.interval, MIN_INTERVAL_SECONDS) * 1000
    while (Date.now() < deadline) {
      if (approval.isCancelled()) throw approval.cancelled()
      await new Promise((done: (value: unknown) => void) => setTimeout(done, interval))
      const answer: TokenPoll = await repository.pollDeviceGrant(approval.grant.deviceCode)
      if (answer.state === 'approved' && answer.token) return answer.token
      if (answer.state === 'denied') throw new DomainError(msg('The sign-in was denied.'))
      if (answer.state === 'expired') break
    }
    throw new DomainError(msg('The sign-in code expired.'))
  }

  public async createSession(host: string, token: string, scopes: readonly string[]): Promise<Session> {
    const principal: Principal = await this.connection.signIn(host).principal(token)
      .catch((): Principal => ({ label: null, scopes: [...scopes] }))
    const session: Session = { id: `${host}#${String(Date.now())}`, host, token, label: principal.label ?? host, scopes: principal.scopes }
    await this.sessions.save([...(await this.sessions.all()).filter((stored: Session) => stored.host !== host), session])
    return session
  }

  public async forHost(host: string): Promise<Session[]> {
    return (await this.sessions.all()).filter((session: Session) => session.host === host)
  }

  public async remove(id: string): Promise<Session | null> {
    const all: Session[] = await this.sessions.all()
    await this.sessions.save(all.filter((session: Session) => session.id !== id))
    return all.find((session: Session) => session.id === id) ?? null
  }
}
