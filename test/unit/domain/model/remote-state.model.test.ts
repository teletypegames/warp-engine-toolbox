import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Release, Software } from '../../../../src/domain/model/catalog.model'
import type { Project } from '../../../../src/domain/model/project.model'
import { RemoteStates, type RemoteState } from '../../../../src/domain/model/remote-state.model'

const project = { name: 'rabbit', folder: '/tmp/rabbit' } as unknown as Project
const software: Software = { id: 7, name: 'rabbit', title: 'Rabbit', platform: 'tic80', status: 'draft', category: null, author: null, desc: null, license: null }
const release: Release = { id: 3, softwareId: 7, version: '1.0.0', commitSha: 'abc', assets: [], createdAt: '2026-11-20T10:00:00Z' }

function state(changes: Partial<RemoteState> = {}): RemoteState {
  return { ...RemoteStates.empty(project, { head: 'abc', branch: 'master', defaultBranch: 'master' }, true), ...changes }
}

describe('RemoteStates.catalogKey', () => {
  it('is empty without a session, with an error or without a state', () => {
    assert.equal(RemoteStates.catalogKey(null), '')
    assert.equal(RemoteStates.catalogKey(state({ signedIn: false })), '')
    assert.equal(RemoteStates.catalogKey(state({ error: 'down' })), '')
  })

  it('changes when the software appears and when a release is added or gains assets', () => {
    const before: string = RemoteStates.catalogKey(state())
    const connected: string = RemoteStates.catalogKey(state({ software }))
    const released: string = RemoteStates.catalogKey(state({ software, releases: [release] }))
    const uploaded: string = RemoteStates.catalogKey(state({ software, releases: [{ ...release, assets: [{} as never] }] }))
    assert.equal(new Set([before, connected, released, uploaded]).size, 4)
  })

  it('stays the same while only the runs change', () => {
    const run = { number: 1, status: 'running', branch: 'master', message: null, createdAt: null, url: null, commit: 'abc', event: 'push', ref: null }
    assert.equal(RemoteStates.catalogKey(state({ software, runs: [run], headRun: run })), RemoteStates.catalogKey(state({ software })))
  })
})

describe('RemoteStates.releaseOf', () => {
  const run = { number: 4, status: 'success', branch: 'master', message: null, createdAt: null, url: null, commit: 'abc', event: 'tag', ref: 'refs/tags/v1.1.0' }
  const tagged: Release = { ...release, id: 4, version: '1.1.0', commitSha: 'def' }
  const dev: Release = { ...release, id: 5, version: 'dev-feature-abc', commitSha: 'abc' }

  it('takes the release of the tag first', () => {
    assert.equal(RemoteStates.releaseOf(state({ releases: [release, tagged] }), run)?.version, '1.1.0')
  })

  it('falls back to a listed release of the commit, then to its development build', () => {
    const push = { ...run, event: 'push', ref: 'refs/heads/master' }
    assert.equal(RemoteStates.releaseOf(state({ releases: [dev, release] }), push)?.version, '1.0.0')
    assert.equal(RemoteStates.releaseOf(state({ releases: [dev] }), push)?.version, 'dev-feature-abc')
    assert.equal(RemoteStates.releaseOf(state({ releases: [tagged] }), push), null)
  })
})

describe('RemoteStates.runOutcome', () => {
  const run = { number: 9, status: 'success', branch: 'master', message: null, createdAt: null, url: null, commit: 'abc', event: 'tag', ref: 'refs/tags/v1.0.0' }

  it('tells a failure, a published release, a pass without one and a development build apart', () => {
    assert.equal(RemoteStates.runOutcome(state())?.kind, undefined)
    assert.equal(RemoteStates.runOutcome(state({ headRun: { ...run, status: 'failure' } }))?.kind, 'failed')
    assert.equal(RemoteStates.runOutcome(state({ headRun: run, releases: [release] }))?.kind, 'published')
    assert.equal(RemoteStates.runOutcome(state({ headRun: { ...run, ref: null, commit: 'zzz' }, releases: [release] }))?.kind, 'passed')
    assert.equal(RemoteStates.runOutcome(state({ headRun: { ...run, ref: null }, releases: [{ ...release, version: 'dev-x-abc' }] }))?.kind, 'devBuild')
  })
})
