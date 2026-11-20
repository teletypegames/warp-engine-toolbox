import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Principal } from '../../../../src/domain/model/catalog.model'
import { HostError } from '../../../../src/domain/model/host-error.model'
import { DomainError } from '../../../../src/domain/model/message.model'
import type { Session } from '../../../../src/domain/model/sign-in.model'
import type { SessionRepository } from '../../../../src/domain/repository/session.repository'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import { SignInService } from '../../../../src/domain/service/sign-in.service'

class MemorySessions implements SessionRepository {
  public stored: Session[] = []
  public async all(): Promise<Session[]> { return Promise.resolve(this.stored) }
  public async save(sessions: readonly Session[]): Promise<void> { this.stored = [...sessions]; return Promise.resolve() }
}

function host(valid: readonly string[], down: boolean = false): ConnectionService {
  const principal = async (token: string): Promise<Principal> => {
    if (down) throw new HostError('down', 502)
    if (!valid.includes(token)) throw new HostError('Unauthorized', 401)
    return Promise.resolve({ label: 'admin', scopes: ['catalog:read'] })
  }
  return { signIn: () => ({ principal }) } as unknown as ConnectionService
}

describe('SignInService', () => {
  it('stores nothing when the host refuses the token', async () => {
    const sessions = new MemorySessions()
    await assert.rejects(new SignInService(host([]), sessions).createSession('http://h', 'stale', []), (error: unknown) => HostError.isUnauthorized(error))
    assert.equal(sessions.stored.length, 0)
  })

  it('still stores the session when the host cannot say who the token belongs to', async () => {
    const sessions = new MemorySessions()
    await new SignInService(host([], true), sessions).createSession('http://h', 'any', ['x'])
    assert.deepEqual(sessions.stored.map((session: Session) => [session.token, session.scopes]), [['any', ['x']]])
  })

  it('takes the first token the host accepts', async () => {
    const sessions = new MemorySessions()
    const session: Session = await new SignInService(host(['fresh']), sessions).createFirstSession('http://h', ['stale', 'fresh'], [])
    assert.equal(session.token, 'fresh')
    assert.equal(sessions.stored.length, 1)
  })

  it('offers reinstalling the local engine when every token is refused', async () => {
    await assert.rejects(new SignInService(host([]), new MemorySessions()).createFirstSession('http://h', ['a', 'b'], []),
      (error: unknown) => error instanceof DomainError && error.remedy === 'installLocalEngine')
  })
})
