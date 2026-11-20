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
