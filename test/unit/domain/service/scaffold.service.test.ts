import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { TemplateRepository, TemplateTree } from '../../../../src/domain/repository/template.repository'
import { ScaffoldService, type WriteResult } from '../../../../src/domain/service/scaffold.service'
import { FakeGitFactory, MemoryFiles } from '../../fakes'
import { C64 } from '../../fixtures'

const TEMPLATE: TemplateRepository = {
  download: async (): Promise<TemplateTree> => Promise.resolve({
    files: ['example-makefile.make', 'README.md'],
    read: async () => Promise.resolve(new TextEncoder().encode('PROJECT = example\nbuild:\n')),
    dispose: async () => Promise.resolve()
  })
}

const ANSWERS = { name: 'rabbit', title: 'Rabbit', author: 'T', license: 'MIT', category: null, description: 'Hops', version: '0.1.0' }

describe('ScaffoldService', () => {
  it('writes the planned files, naming the project in the Makefile, and keeps existing ones when asked', async () => {
    const files: MemoryFiles = new MemoryFiles({ '/new/rabbit/README.md': 'mine' })
    const service: ScaffoldService = new ScaffoldService(TEMPLATE, files, new FakeGitFactory())
    const result: WriteResult = await service.write({ folder: '/new/rabbit', platform: C64, answers: ANSWERS, host: 'https://h', withDemo: false, overwrite: false, report: () => undefined })
    assert.deepEqual(result.skipped, ['README.md'])
    assert.ok(result.written.includes('Makefile') && result.written.includes('metadata.json'))
    assert.equal(files.files.get('/new/rabbit/Makefile'), 'PROJECT = rabbit\nbuild:\n')
  })

  it('fills the game name into the files the manifest lists', async () => {
    const sources: Readonly<Record<string, string>> = {
      'warp-template.json': JSON.stringify({ files: { 'hello/Cargo.toml': 'Cargo.toml', 'hello/hello.inc': '{name}.inc' }, fill: ['hello/Cargo.toml'] }),
      'hello/Cargo.toml': '[package]\nname = "{name}"\n',
      'hello/hello.inc': 'main.lua\n'
    }
    const template: TemplateRepository = {
      download: async (): Promise<TemplateTree> => Promise.resolve({
        files: Object.keys(sources),
        read: async (path: string) => Promise.resolve(new TextEncoder().encode(sources[path] ?? '')),
        dispose: async () => Promise.resolve()
      })
    }
    const files: MemoryFiles = new MemoryFiles()
    await new ScaffoldService(template, files, new FakeGitFactory()).write({ folder: '/n', platform: C64, answers: ANSWERS, host: 'h', withDemo: false, overwrite: true, report: () => undefined })
    assert.equal(files.files.get('/n/Cargo.toml'), '[package]\nname = "rabbit"\n')
    assert.equal(files.files.get('/n/rabbit.inc'), 'main.lua\n')
  })

  it('creates a new game as a git repository', async () => {
    const git: FakeGitFactory = new FakeGitFactory()
    await new ScaffoldService(TEMPLATE, new MemoryFiles(), git).createGame({ folder: '/n', platform: C64, answers: ANSWERS, host: 'h', withDemo: false, overwrite: true, report: () => undefined })
    assert.deepEqual(git.git.calls, ['init master', 'add', 'commit Start Rabbit'])
  })
})
