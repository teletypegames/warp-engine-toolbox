import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { changelog, prependChangelog } from '../src/domain/changelog'
import { checklist, checklistMark } from '../src/domain/checklist'
import { luaFileFromCommand, luaHeaderValues, setLuaHeaderValue } from '../src/domain/luaHeader'
import { isMarker, parseMarker, renderMarker } from '../src/domain/marker'
import { applyMakefile, exampleTarget, planProject, type GameAnswers } from '../src/domain/template'
import { bumpVersion, compareVersions } from '../src/domain/version'
import { C64, TIC80 } from './fixtures'

const ANSWERS: GameAnswers = { name: 'rabbit', title: 'Rabbit', author: 'Teletype', license: 'MIT', category: 'game', description: 'Hops', version: '0.1.0' }

describe('marker', () => {
  it('reads the platform, the name and the options of a marker', () => {
    const marker = parseMarker('# comment\nplatform: c64\nname: "rabbit"  # the software\nrelease: tag\n')
    assert.deepEqual(marker, { platform: 'c64', name: 'rabbit', options: { release: 'tag' } })
    assert.equal(isMarker('platform: c64\n'), true)
  })

  it('does not take a full pipeline for a marker', () => {
    assert.equal(isMarker('steps:\n  build:\n    image: x\n'), false)
    assert.equal(isMarker('platform: c64\nsteps:\n  a: 1\n'), false)
  })

  it('renders a marker with its preview comment', () => {
    assert.equal(renderMarker('c64', null, 'https://h/build/config?platform=c64'),
      '# One-line marker: the WarpEngine host serves the full pipeline. Preview it with:\n#   curl "https://h/build/config?platform=c64"\nplatform: c64\n')
  })
})

describe('Lua header', () => {
  const source = '-- title: Rabbit\n-- version: 1.0.0\n-- script: lua\nfunction TIC() end\n-- version: 9\n'

  it('reads the header up to the first line that is no comment', () => {
    assert.deepEqual(luaHeaderValues(source), { title: 'Rabbit', version: '1.0.0', script: 'lua' })
  })

  it('changes a value in place and adds a missing one at the end of the header', () => {
    assert.equal(setLuaHeaderValue(source, 'version', '1.1.0').split('\n')[1], '-- version: 1.1.0')
    assert.equal(setLuaHeaderValue(source, 'site', 'https://x').split('\n')[3], '-- site: https://x')
  })

  it('finds the Lua file a version command reads', () => {
    assert.equal(luaFileFromCommand(TIC80.version.command), 'inc/meta/meta.header.lua')
    assert.equal(luaFileFromCommand('cat VERSION'), null)
  })
})

describe('version', () => {
  it('bumps each part', () => {
    assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4')
    assert.equal(bumpVersion('v1.2.3', 'minor'), '1.3.0')
    assert.equal(bumpVersion('1.2.3-beta', 'major'), '2.0.0')
    assert.equal(bumpVersion('1.2', 'patch'), '1.2.1')
  })

  it('compares numerically', () => {
    assert.ok(compareVersions('1.10.0', '1.9.0') > 0)
    assert.equal(compareVersions('v1.0.0', '1.0.0'), 0)
  })
})

describe('template', () => {
  it('maps the example files of a tools repository', () => {
    assert.equal(exampleTarget('example-makefile.make'), 'Makefile')
    assert.equal(exampleTarget('example-tasks.json'), '.vscode/tasks.json')
    assert.equal(exampleTarget('example-export_presets.cfg'), 'export_presets.cfg')
    assert.equal(exampleTarget('example-woodpecker.yaml'), null)
    assert.equal(exampleTarget('example-metadata.json'), null)
    assert.equal(exampleTarget('player/example-x'), null)
    assert.equal(exampleTarget('README.md'), null)
  })

  it('plans a project: template, demo over it, generated marker, metadata, readme and recommendations', () => {
    const plan = planProject({
      platform: C64, answers: ANSWERS, host: 'https://h/',
      templateFiles: ['README.md', 'builder.Dockerfile', 'example-makefile.make', 'example-metadata.json', 'example-tasks.json', 'example-woodpecker.yaml'],
      manifest: null,
      demoFiles: ['.git/HEAD', '.woodpecker.yaml', 'LICENSE', 'Makefile', 'README.md', 'main.asm', 'metadata.json'],
      luaFile: null
    })
    const targets = plan.map((file) => file.target)
    assert.deepEqual(targets, ['.gitignore', '.vscode/extensions.json', '.vscode/tasks.json', '.woodpecker.yaml', 'main.asm', 'Makefile', 'metadata.json', 'README.md'])
    assert.deepEqual(plan.find((file) => file.target === 'Makefile')?.source, { root: 'demo', path: 'Makefile' })
    assert.equal(plan.find((file) => file.target === 'Makefile')?.transform, 'makefile')
    const metadata = JSON.parse(plan.find((file) => file.target === 'metadata.json')?.content ?? '{}') as Record<string, unknown>
    assert.deepEqual(metadata, { name: 'rabbit', title: 'Rabbit', author: 'Teletype', desc: 'Hops', license: 'MIT', category: 'game', version: '0.1.0' })
    assert.match(plan.find((file) => file.target === '.woodpecker.yaml')?.content ?? '', /platform: c64\n$/)
  })

  it('follows a template manifest and writes the Lua header where the version command reads it', () => {
    const plan = planProject({
      platform: TIC80, answers: ANSWERS, host: 'https://h', templateFiles: ['a.mk'], manifest: { files: { 'a.mk': 'Makefile' } },
      demoFiles: [], luaFile: 'inc/meta/meta.header.lua'
    })
    assert.deepEqual(plan.map((file) => file.target), ['.gitignore', '.woodpecker.yaml', 'inc/meta/meta.header.lua', 'Makefile', 'README.md'])
    assert.match(plan.find((file) => file.target === 'inc/meta/meta.header.lua')?.content ?? '', /^-- title: Rabbit\n[\s\S]*-- version: 0.1.0\n/)
  })

  it('names the project in the Makefile', () => {
    assert.equal(applyMakefile('PROJECT = example\nall: build\n', 'rabbit'), 'PROJECT = rabbit\nall: build\n')
    assert.equal(applyMakefile('PROJECT ?= x\n', 'rabbit'), 'PROJECT ?= rabbit\n')
    assert.equal(applyMakefile('NAME = x\n', 'rabbit'), 'NAME = x\n')
  })
})

describe('checklist', () => {
  it('marks what a release has, misses, and what the pipeline does not build', () => {
    const entries = checklist(C64, [{ id: 1, kind: 'cartridge', path: '/x.prg' }])
    assert.deepEqual(entries.map((entry) => `${checklistMark(entry.state)} ${entry.kind}`), ['[x] cartridge', '[ ] win_x64', '[-] mac_arm64'])
  })
})

describe('changelog', () => {
  it('lists the commits since the last tag, without merges', () => {
    const entry: string = changelog('1.1.0', [{ sha: 'abcdef123', subject: 'Faster rabbit' }, { sha: '1234567aa', subject: 'Merge branch x' }], '2026-11-17')
    assert.equal(entry, '## 1.1.0 — 2026-11-17\n\n- Faster rabbit (abcdef1)\n')
    assert.equal(prependChangelog('# Changelog\n\n## 1.0.0\n', entry), `# Changelog\n\n${entry}\n## 1.0.0\n`)
  })
})
