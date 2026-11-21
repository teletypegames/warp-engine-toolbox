import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Marker } from '../../../../src/domain/model/marker.model'
import { DomainError } from '../../../../src/domain/model/message.model'
import { Metadata } from '../../../../src/domain/model/metadata.model'
import { Project } from '../../../../src/domain/model/project.model'
import { TasksDocument } from '../../../../src/domain/model/tasks-document.model'
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

  it('gives a new game the dev container of the template: files filled with the builder image, tasks merged', async () => {
    const files: MemoryFiles = new MemoryFiles()
    await new ScaffoldService(devTemplate(), files, new FakeGitFactory()).write({ folder: '/n', platform: C64, answers: ANSWERS, host: 'h', withDemo: false, overwrite: true, report: () => undefined })
    assert.equal(files.files.get('/n/.devcontainer/Dockerfile'), 'FROM registry/c64-builder\n')
    assert.equal(files.files.get('/n/.devcontainer/devcontainer.json'), '{ "name": "Rabbit" }')
    assert.deepEqual(new TasksDocument(files.files.get('/n/.vscode/tasks.json') ?? null).labels(), ['build', 'play'])
  })

  it('adds the dev container to a project, keeping its files and metadata', async () => {
    const files: MemoryFiles = new MemoryFiles({ '/games/rabbit/.devcontainer/Dockerfile': 'mine', '/games/rabbit/metadata.json': '{"name":"rabbit","version":"1.2.0"}' })
    const result: WriteResult = await new ScaffoldService(devTemplate(), files, new FakeGitFactory()).addDevContainer({ project: project(), host: 'h', report: () => undefined })
    assert.deepEqual(result.written.sort(), ['.devcontainer/devcontainer.json', '.vscode/tasks.json'])
    assert.deepEqual(result.skipped, ['.devcontainer/Dockerfile'])
    assert.deepEqual(result.tasks, ['play'])
    assert.equal(files.files.get('/games/rabbit/.devcontainer/Dockerfile'), 'mine')
    assert.equal(files.files.get('/games/rabbit/metadata.json'), '{"name":"rabbit","version":"1.2.0"}')
    assert.equal(files.files.has('/games/rabbit/Makefile'), false)
  })

  it('refuses to add a dev container the template has not got', async () => {
    await assert.rejects(new ScaffoldService(TEMPLATE, new MemoryFiles(), new FakeGitFactory()).addDevContainer({ project: project(), host: 'h', report: () => undefined }), DomainError)
  })
})

function project(): Project {
  return new Project({
    folder: '/games/rabbit', folderName: 'rabbit', markerPath: '/games/rabbit/.woodpecker.yaml', marker: Marker.parse('platform: c64\n'),
    platform: C64, metadataPath: '/games/rabbit/metadata.json', metadataFormat: 'json', metadata: Metadata.parse('{"name":"rabbit","title":"Rabbit","version":"1.2.0"}', 'json')
  })
}

function devTemplate(): TemplateRepository {
  const sources: Readonly<Record<string, string>> = {
    'warp-template.json': JSON.stringify({
      files: { 'example-tasks.json': '.vscode/tasks.json' },
      devcontainer: { files: { 'dc.json': '.devcontainer/devcontainer.json', 'dc.Dockerfile': '.devcontainer/Dockerfile' }, fill: ['dc.json', 'dc.Dockerfile'], tasks: 'dc-tasks.json' }
    }),
    'example-tasks.json': JSON.stringify({ version: '2.0.0', tasks: [{ label: 'build', type: 'warpengine', target: 'build' }] }),
    'dc.json': '{ "name": "{title}" }',
    'dc.Dockerfile': 'FROM {builderImage}\n',
    'dc-tasks.json': JSON.stringify({ version: '2.0.0', tasks: [{ label: 'play', type: 'warpengine', action: 'play' }] })
  }
  return {
    download: async (): Promise<TemplateTree> => Promise.resolve({
      files: Object.keys(sources),
      read: async (path: string) => Promise.resolve(new TextEncoder().encode(sources[path] ?? '')),
      dispose: async () => Promise.resolve()
    })
  }
}
