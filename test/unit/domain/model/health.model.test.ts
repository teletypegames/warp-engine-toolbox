import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { HealthChecks, type HealthCheck, type HealthSection } from '../../../../src/domain/model/health.model'
import type { WellKnown } from '../../../../src/domain/model/local-engine.model'
import type { Project } from '../../../../src/domain/model/project.model'
import { RemoteStates, type RemoteState } from '../../../../src/domain/model/remote-state.model'
import type { ServerContainer } from '../../../../src/domain/model/server.model'

const info = { version: '5.5.3', profile: 'local' } as WellKnown
const host = { name: 'Local', url: 'http://127.0.0.1:7470' }

function container(name: string, state: string = 'running'): ServerContainer {
  return { id: name, name, image: 'x', state, status: state, hostPorts: [7470], folder: null }
}

function titles(section: HealthSection | null): string[] {
  return (section?.checks ?? []).map((check: HealthCheck) => `${check.status}:${check.title.text}:${check.remedy ?? ''}`)
}

describe('Health', () => {
  it('asks for a host first, then for a sign-in, and to sign in again when the token is refused', () => {
    assert.deepEqual(titles(HealthChecks.host({ host: null, info: null, signedIn: false, principal: null, refused: false })), ['error:No host is set:selectHost'])
    assert.deepEqual(titles(HealthChecks.host({ host, info, signedIn: false, principal: null, refused: false })), ['ok:{0} answers:', 'warning:Not signed in:signIn'])
    assert.deepEqual(titles(HealthChecks.host({ host, info: null, signedIn: true, principal: null, refused: true }))[1], 'error:The host refused the stored token:reauthorize')
  })

  it('shows the local engine only when it is there or it is the host, and Docker when it does not answer', () => {
    assert.equal(HealthChecks.local({ isCurrentHost: false, containers: [] }), null)
    assert.equal(HealthChecks.local({ isCurrentHost: false, containers: null }), null)
    assert.deepEqual(titles(HealthChecks.local({ isCurrentHost: true, containers: null })), ['error:Docker does not answer:'])
    assert.deepEqual(titles(HealthChecks.local({ isCurrentHost: true, containers: [container('warp-engine-local')] })),
      ['ok:The local engine runs:', 'info:The local CI is not installed:installLocalEngine'])
    assert.deepEqual(titles(HealthChecks.local({ isCurrentHost: true, containers: [container('warp-engine-local'), container('warp-engine-local-gitea', 'exited')] }))[1],
      'error:The local CI is partly stopped:')
  })

  it('offers Connect elsewhere and Set up local CI on the local engine for a project not on the host', () => {
    const project = { title: 'Rabbit', platform: { label: 'TIC-80' }, platformName: 'tic80', metadataPath: null } as unknown as Project
    const state: RemoteState = RemoteStates.empty(project, { head: 'abc', branch: 'master', defaultBranch: 'master' }, true)
    const facts = { project, check: null, state, adminUrl: null }
    assert.deepEqual(titles(HealthChecks.project({ ...facts, local: false })).at(-1), 'warning:Not on the host yet:connect')
    assert.deepEqual(titles(HealthChecks.project({ ...facts, local: true })).at(-1), 'warning:Not on the host yet:setupLocalCi')
    assert.equal(HealthChecks.worst(HealthChecks.project({ ...facts, local: true }).checks), 'warning')
  })
})
