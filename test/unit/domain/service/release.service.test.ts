import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Marker } from '../../../../src/domain/model/marker.model'
import { Metadata } from '../../../../src/domain/model/metadata.model'
import { Project } from '../../../../src/domain/model/project.model'
import type { ConnectionService } from '../../../../src/domain/service/connection.service'
import type { ProjectService } from '../../../../src/domain/service/project.service'
import { ReleaseService } from '../../../../src/domain/service/release.service'
import { FakeGitFactory, MemoryFiles } from '../../fakes'
import { C64 } from '../../fixtures'

const METADATA = '/games/rabbit/metadata.json'

function project(): Project {
  return new Project({
    folder: '/games/rabbit', folderName: 'rabbit', markerPath: '/games/rabbit/.woodpecker.yaml', marker: Marker.parse('platform: c64\n'),
    platform: C64, metadataPath: METADATA, metadataFormat: 'json', metadata: Metadata.parse('{"name":"rabbit","version":"0.1.0"}', 'json')
  })
}

function service(files: MemoryFiles, git: FakeGitFactory): ReleaseService {
  return new ReleaseService(git, files, Object.create(null) as ConnectionService, Object.create(null) as ProjectService)
}

describe('ReleaseService', () => {
  it('says what stands in the way of a release', async () => {
    const git: FakeGitFactory = new FakeGitFactory()
    const releases: ReleaseService = service(new MemoryFiles(), git)
    assert.equal(await releases.readiness(project()), 'ready')
    git.git.clean = false
    assert.equal(await releases.readiness(project()), 'dirty')
    git.git.origin = null
    assert.equal(await releases.readiness(project()), 'unconnected')
  })

  it('offers stable and beta versions', () => {
    const releases: ReleaseService = service(new MemoryFiles(), new FakeGitFactory())
    assert.deepEqual(releases.candidates('1.2.3', 'stable'), ['1.2.4', '1.3.0', '2.0.0'])
    assert.deepEqual(releases.candidates('1.2.3', 'beta'), ['1.2.4-beta.1', '1.3.0-beta.1', '2.0.0-beta.1'])
  })

  it('writes the version and the changelog, then commits, tags and pushes', async () => {
    const files: MemoryFiles = new MemoryFiles({ [METADATA]: '{"name":"rabbit","version":"0.1.0"}' })
    const git: FakeGitFactory = new FakeGitFactory()
    await service(files, git).release({ project: project(), version: '0.2.0', report: () => undefined })
    assert.match(files.files.get(METADATA) ?? '', /"version": "0.2.0"/)
    assert.match(files.files.get('/games/rabbit/CHANGELOG.md') ?? '', /^# Changelog\n\n## 0\.2\.0 — \d{4}-\d{2}-\d{2}\n\n- Faster rabbit \(abcdef1\)\n/)
    assert.deepEqual(git.git.calls, ['fetch', 'add', 'commit Release 0.2.0', 'tag v0.2.0', 'push origin HEAD v0.2.0'])
  })
})
