import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Software } from '../../../../../src/domain/model/catalog.model'
import type { Message } from '../../../../../src/domain/model/message.model'
import type { DashboardData } from '../../../../../src/extension/view/dashboard/dashboard.collector'
import { DashboardRenderer } from '../../../../../src/extension/view/dashboard/dashboard.renderer'

const fill = (text: string, args: readonly (string | number)[]): string => text.replace(/\{(\d+)\}/g, (_: string, index: string) => String(args[Number(index)] ?? ''))
const RENDERER: DashboardRenderer = new DashboardRenderer({
  t: (text: string, ...args: (string | number)[]) => fill(text, args),
  message: (message: Message) => fill(message.text, message.args),
  remedy: (remedy) => ({ label: `fix ${remedy}`, command: `warpengine.${remedy}` }),
  time: (value: string | null) => value ?? '',
  ago: (value: string | null) => (value ? `ago ${value}` : '')
})
const PAGE = { cspSource: 'vscode-resource:', nonce: 'NONCE', style: 'style.css', script: 'script.js' }

const DATA: DashboardData = {
  host: { name: 'Local', url: 'http://127.0.0.1:7470' },
  project: { title: 'Rabbit <b>', name: 'rabbit', platform: 'TIC-80', version: '1.2.0', branch: 'master' },
  health: [{ title: { text: 'Host', args: [] }, checks: [{ title: { text: 'Not signed in', args: [] }, status: 'warning', detail: null, remedy: 'signIn', url: null }] }],
  runs: [{ number: 7, status: 'failure', branch: 'master', message: null, createdAt: null, url: 'http://ci/7', commit: 'abcdef123', event: 'push', ref: null }],
  head: 'abcdef123',
  releases: [{ release: { id: 1, softwareId: 1, version: '1.2.0', commitSha: 'abcdef123', assets: [], createdAt: null }, playUrl: 'http://127.0.0.1:7470/play/rabbit/1.2.0' }],
  branchBuild: null, catalog: null, containers: [], sync: null
}

describe('DashboardRenderer', () => {
  it('locks the page down with a CSP and a nonced script', () => {
    const page: string = RENDERER.render(DATA, PAGE)
    assert.match(page, /default-src 'none'; style-src vscode-resource:; script-src 'nonce-NONCE'/)
    assert.ok(page.includes('<script nonce="NONCE" src="script.js"></script>'))
  })

  it('escapes the project texts and lists the runs, releases and the fixes as commands and links', () => {
    const page: string = RENDERER.render(DATA, PAGE)
    assert.ok(page.includes('Rabbit &lt;b&gt;'))
    assert.ok(page.includes('data-command="warpengine.signIn">fix signIn</button>'))
    assert.ok(page.includes('<tr class="head">'))
    assert.ok(page.includes('data-url="http://ci/7">#7</a>'))
    assert.ok(page.includes('data-url="http://127.0.0.1:7470/play/rabbit/1.2.0"'))
    assert.ok(page.includes('data-command="warpengine.installLocalEngine"'))
    assert.ok(!page.includes('>Sync<'))
  })

  it('lists the catalog last, as a table, with Open for a project opened before', () => {
    const software = (name: string): Software => ({ id: 1, name, title: name.toUpperCase(), platform: 'tic80', status: 'published', category: null, author: null, desc: null, license: null })
    const catalog = { principal: 'admin', softwares: [
      { software: software('rabbit'), platform: 'TIC-80', local: 'here' as const },
      { software: software('fox'), platform: 'TIC-80', local: 'known' as const },
      { software: software('owl'), platform: 'TIC-80', local: null }
    ] }
    const page: string = RENDERER.render({ ...DATA, catalog, sync: [] }, PAGE)
    assert.ok(page.indexOf('>Catalog') > page.indexOf('>Sync<'))
    assert.ok(page.indexOf('>Sync<') > page.indexOf('>Local Server<'))
    assert.ok(page.includes('<button class="small" data-open="fox">Open</button>'))
    assert.ok(!page.includes('data-open="owl"'))
    assert.ok(page.includes('<span class="tag">open</span>'))
  })

  it('shows the five newest runs and releases, and all of them behind More', () => {
    const [run] = DATA.runs
    const [release] = DATA.releases
    assert.ok(run && release)
    const runs = Array.from({ length: 7 }, (_: unknown, index: number) => ({ ...run, number: 20 - index, url: `http://ci/${String(20 - index)}` }))
    const releases = Array.from({ length: 3 }, (_: unknown, index: number) => ({ ...release, release: { ...release.release, version: `1.${String(index)}`, createdAt: '2026-11-20T10:00:00Z' } }))
    const page: string = RENDERER.render({ ...DATA, runs, releases }, PAGE)
    assert.ok(page.includes('Pipeline <span class="count">7</span>'))
    assert.ok(page.includes('data-dialog="runs">More (2)</button>'))
    assert.ok(page.includes('<dialog id="runs">'))
    assert.equal(page.split('data-url="http://ci/14"').length - 1, 1)
    assert.ok(!page.includes('data-dialog="releases"'))
    assert.ok(page.includes('<tr class="latest"><td><b>1.0</b> <span class="tag">latest</span>'))
    assert.ok(page.includes('<span title="2026-11-20T10:00:00Z">ago 2026-11-20T10:00:00Z</span>'))
  })

  it('offers a new game without a project', () => {
    const page: string = RENDERER.render({ ...DATA, project: null, runs: [], releases: [] }, PAGE)
    assert.ok(page.includes('data-command="warpengine.newGame"'))
    assert.ok(!page.includes('>Pipeline<'))
  })
})
