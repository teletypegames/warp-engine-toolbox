import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { DomainError } from '../../../../src/domain/model/message.model'
import { Metadata } from '../../../../src/domain/model/metadata.model'
import { Marker } from '../../../../src/domain/model/marker.model'
import { Project } from '../../../../src/domain/model/project.model'
import { UpstreamService, type PullResult } from '../../../../src/domain/service/upstream.service'
import { FakeGit, FakeGitFactory } from '../../fakes'
import { C64 } from '../../fixtures'

const PROJECT: Project = new Project({
  folder: '/w/rabbit-bob', folderName: 'rabbit-bob', markerPath: '/w/rabbit-bob/.woodpecker.yaml', marker: Marker.parse('platform: c64\n'), platform: C64,
  metadataPath: '/w/rabbit-bob/metadata.json', metadataFormat: 'json', metadata: new Metadata({ name: 'rabbit-bob', title: 'Rabbit Bob' })
})

function fork(): FakeGit {
  const git: FakeGit = new FakeGit()
  git.named.set('upstream', 'https://git.example/games/rabbit.git')
  return git
}

describe('UpstreamService', () => {
  it('fetches the upstream and merges its default branch', async () => {
    const git: FakeGit = fork()
    const service: UpstreamService = new UpstreamService(new FakeGitFactory(git))
    assert.equal(await service.hasUpstream(PROJECT), true)
    const result: PullResult = await service.pull(PROJECT, () => undefined)
    assert.deepEqual(result, { state: 'merged', conflicts: [], ref: 'upstream/master' })
    assert.deepEqual(git.calls, ['fetch upstream', 'merge upstream/master'])
  })

  it('hands the conflicts back', async () => {
    const git: FakeGit = fork()
    git.mergeOutcome = { state: 'conflict', conflicts: ['main.asm'] }
    assert.deepEqual((await new UpstreamService(new FakeGitFactory(git)).pull(PROJECT, () => undefined)).conflicts, ['main.asm'])
  })

  it('refuses a project without upstream or with changes', async () => {
    await assert.rejects(new UpstreamService(new FakeGitFactory()).pull(PROJECT, () => undefined), DomainError)
    const dirty: FakeGit = fork()
    dirty.clean = false
    await assert.rejects(new UpstreamService(new FakeGitFactory(dirty)).pull(PROJECT, () => undefined), DomainError)
  })

  it('offers to try again when the fetch fails', async () => {
    const git: FakeGit = fork()
    git.fetchError = new Error('fatal: unable to access: Could not resolve host: git.example')
    await assert.rejects(new UpstreamService(new FakeGitFactory(git)).pull(PROJECT, () => undefined),
      (error: unknown) => error instanceof DomainError && error.remedy === 'pullUpstream')
  })
})
