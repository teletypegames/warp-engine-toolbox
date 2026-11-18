import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { GameAnswers } from '../../../../src/domain/model/game-answers.model'
import { Makefile } from '../../../../src/domain/model/makefile.model'
import { ProjectPlan, type PlannedFile } from '../../../../src/domain/model/project-plan.model'
import { C64, TIC80 } from '../../fixtures'

const ANSWERS: GameAnswers = { name: 'rabbit', title: 'Rabbit', author: 'Teletype', license: 'MIT', category: 'game', description: 'Hops', version: '0.1.0' }

function find(plan: readonly PlannedFile[], target: string): PlannedFile | undefined {
  return plan.find((file: PlannedFile) => file.target === target)
}

describe('ProjectPlan', () => {
  it('maps the example files of a tools repository', () => {
    assert.equal(ProjectPlan.exampleTarget('example-makefile.make'), 'Makefile')
    assert.equal(ProjectPlan.exampleTarget('example-tasks.json'), '.vscode/tasks.json')
    assert.equal(ProjectPlan.exampleTarget('example-export_presets.cfg'), 'export_presets.cfg')
    assert.equal(ProjectPlan.exampleTarget('example-woodpecker.yaml'), null)
    assert.equal(ProjectPlan.exampleTarget('example-metadata.json'), null)
    assert.equal(ProjectPlan.exampleTarget('player/example-x'), null)
    assert.equal(ProjectPlan.exampleTarget('README.md'), null)
  })

  it('plans a project: template, demo over it, generated marker, metadata, readme and recommendations', () => {
    const plan: PlannedFile[] = new ProjectPlan({
      platform: C64, answers: ANSWERS, host: 'https://h/',
      templateFiles: ['README.md', 'builder.Dockerfile', 'example-makefile.make', 'example-metadata.json', 'example-tasks.json', 'example-woodpecker.yaml'],
      manifest: null,
      demoFiles: ['.git/HEAD', '.woodpecker.yaml', 'LICENSE', 'Makefile', 'README.md', 'main.asm', 'metadata.json']
    }).list()
    assert.deepEqual(plan.map((file: PlannedFile) => file.target), ['.gitignore', '.vscode/extensions.json', '.vscode/tasks.json', '.woodpecker.yaml', 'main.asm', 'Makefile', 'metadata.json', 'README.md'])
    assert.deepEqual(find(plan, 'Makefile')?.source, { root: 'demo', path: 'Makefile' })
    assert.equal(find(plan, 'Makefile')?.transform, 'makefile')
    const metadata = JSON.parse(find(plan, 'metadata.json')?.content ?? '{}') as Record<string, unknown>
    assert.deepEqual(metadata, { name: 'rabbit', title: 'Rabbit', author: 'Teletype', desc: 'Hops', license: 'MIT', category: 'game', version: '0.1.0' })
    assert.match(find(plan, '.woodpecker.yaml')?.content ?? '', /platform: c64\n$/)
  })

  it('follows a template manifest and writes the Lua header where the version command reads it', () => {
    const plan: PlannedFile[] = new ProjectPlan({ platform: TIC80, answers: ANSWERS, host: 'https://h', templateFiles: ['a.mk'], manifest: { files: { 'a.mk': 'Makefile' } }, demoFiles: [] }).list()
    assert.deepEqual(plan.map((file: PlannedFile) => file.target), ['.gitignore', '.woodpecker.yaml', 'inc/meta/meta.header.lua', 'Makefile', 'README.md'])
    assert.match(find(plan, 'inc/meta/meta.header.lua')?.content ?? '', /^-- title: Rabbit\n[\s\S]*-- version: 0.1.0\n/)
  })

  it('names manifest targets and marks the files to fill after the game', () => {
    const manifest = { files: { 'hello/hello.inc': '{name}.inc', 'hello/Cargo.toml': 'Cargo.toml', 'a.mk': 'Makefile' }, fill: ['hello/Cargo.toml'] }
    const plan: PlannedFile[] = new ProjectPlan({ platform: TIC80, answers: ANSWERS, host: 'https://h', templateFiles: [], manifest, demoFiles: [] }).list()
    assert.equal(find(plan, `${ANSWERS.name}.inc`)?.source?.path, 'hello/hello.inc')
    assert.equal(find(plan, 'Cargo.toml')?.transform, 'fill')
    assert.equal(find(plan, `${ANSWERS.name}.inc`)?.transform, null)
    assert.equal(find(plan, 'Makefile')?.transform, 'makefile')
  })

  it('follows a demo manifest: keeps what it names, edits JSON, fills, and leaves itself out', () => {
    const demoManifest = { keep: ['LICENSE'], fill: ['src/about.txt'], json: { 'package.json': { 'warpEngine.brand.name': '{title}' } } }
    const plan: PlannedFile[] = new ProjectPlan({
      platform: C64, answers: ANSWERS, host: 'https://h', templateFiles: [], manifest: null,
      demoFiles: ['LICENSE', 'README.md', 'package.json', 'src/about.txt', 'warp-template.json'], demoManifest
    }).list()
    const targets: string[] = plan.map((file: PlannedFile) => file.target)
    assert.ok(targets.includes('LICENSE'))
    assert.ok(!targets.includes('warp-template.json'))
    assert.equal(find(plan, 'README.md')?.source, null)
    assert.equal(find(plan, 'package.json')?.transform, 'json')
    assert.deepEqual(find(plan, 'package.json')?.edits, { 'warpEngine.brand.name': '{title}' })
    assert.equal(find(plan, 'src/about.txt')?.transform, 'fill')
  })

  it('leaves the template-only files out when a demo comes along', () => {
    const manifest = { files: { 'hello/main.js': 'main.js', 'example-tasks.json': '.vscode/tasks.json' }, templateOnly: ['hello/main.js'] }
    const alone: string[] = new ProjectPlan({ platform: C64, answers: ANSWERS, host: 'https://h', templateFiles: [], manifest, demoFiles: [] }).list().map((file: PlannedFile) => file.target)
    const withDemo: string[] = new ProjectPlan({ platform: C64, answers: ANSWERS, host: 'https://h', templateFiles: [], manifest, demoFiles: ['src/app.ts'] }).list().map((file: PlannedFile) => file.target)
    assert.ok(alone.includes('main.js'))
    assert.ok(!withDemo.includes('main.js'))
    assert.ok(withDemo.includes('.vscode/tasks.json'))
  })

  it('names the project in the Makefile and lists its targets', () => {
    assert.equal(new Makefile('PROJECT = example\nall: build\n').withProject('rabbit'), 'PROJECT = rabbit\nall: build\n')
    assert.equal(new Makefile('PROJECT ?= x\n').withProject('rabbit'), 'PROJECT ?= rabbit\n')
    assert.equal(new Makefile('NAME = x\n').withProject('rabbit'), 'NAME = x\n')
    assert.deepEqual(new Makefile('.PHONY: all\nall: build\nbuild:\n%.o: %.c\nX := 1\n').targets(), ['all', 'build'])
  })
})
