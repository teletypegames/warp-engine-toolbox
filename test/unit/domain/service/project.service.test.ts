import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Platform } from '../../../../src/domain/model/platform.model'
import type { Project } from '../../../../src/domain/model/project.model'
import type { PlatformService } from '../../../../src/domain/service/platform.service'
import { ProjectService } from '../../../../src/domain/service/project.service'
import type { ShellRepository } from '../../../../src/domain/repository/shell.repository'
import { MemoryFiles } from '../../fakes'
import { C64, TIC80 } from '../../fixtures'

function platforms(...known: Platform[]): PlatformService {
  return { find: async (name: string | null) => Promise.resolve(known.find((platform: Platform) => platform.name === name) ?? null) } as unknown as PlatformService
}

const SHELL: ShellRepository = { run: async () => Promise.resolve({ code: 0, stdout: '2.0.0\n', stderr: '' }) }

describe('ProjectService', () => {
  it('detects a project from its marker and reads its JSON metadata', async () => {
    const files: MemoryFiles = new MemoryFiles({ '/w/rabbit/.woodpecker.yaml': 'platform: c64\n', '/w/rabbit/metadata.json': '{"name":"bunny","version":"1.0.0"}' })
    const service: ProjectService = new ProjectService(files, platforms(C64), SHELL)
    const project: Project | null = await service.detect({ path: '/w/rabbit', name: 'rabbit' })
    assert.ok(project)
    assert.equal(project.name, 'bunny')
    assert.equal(project.platform?.label, 'C64')
    assert.equal(await service.version(project), '1.0.0')
  })

  it('reads a Lua header and the version by the platform command', async () => {
    const files: MemoryFiles = new MemoryFiles({ '/w/t/.woodpecker.yaml': 'platform: tic80\n', '/w/t/inc/meta/meta.header.lua': '-- name: tico\n' })
    const service: ProjectService = new ProjectService(files, platforms(TIC80), SHELL)
    const project: Project | null = await service.detect({ path: '/w/t', name: 't' })
    assert.ok(project)
    assert.equal(project.metadataPath, '/w/t/inc/meta/meta.header.lua')
    assert.equal(project.name, 'tico')
    assert.equal(await service.version(project), '2.0.0')
  })

  it('takes no full pipeline for a project', async () => {
    const service: ProjectService = new ProjectService(new MemoryFiles({ '/w/x/.woodpecker.yaml': 'steps:\n  a: 1\n' }), platforms(), SHELL)
    assert.equal(await service.detect({ path: '/w/x', name: 'x' }), null)
  })
})
