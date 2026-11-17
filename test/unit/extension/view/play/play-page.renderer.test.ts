import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { PlayPageRenderer, type PlayAssets } from '../../../../../src/extension/view/play/play-page.renderer'

const MEDIA: string = join(process.cwd(), 'media', 'webview')
const read = (file: string): string => readFileSync(join(MEDIA, file), 'utf8')
const ASSETS: PlayAssets = { style: read('play.css'), toolbar: read('play-toolbar.js'), start: read('play-start.js'), relay: read('play-relay.js'), handoff: read('play-handoff.js') }
const RENDERER: PlayPageRenderer = new PlayPageRenderer(ASSETS, { replay: 'Build and play again', external: 'Open in browser', clickToStart: 'Click to start', soundHint: 'hint' })
const HOST_PAGE = '<!doctype html><html><head><title>Rabbit</title></head><body><div id="game"></div><script type="module">const runtimeUrl = "/file/_runtimes/emulatorjs-4.2.3/"</script></body></html>'

describe('PlayPageRenderer', () => {
  it('runs the host page in the panel: CSP for the local server, base, nonced scripts, the toolbar and the start hint', () => {
    const page: string = RENDERER.runtime(HOST_PAGE, 'http://127.0.0.1:5000/', 'main.prg')
    const nonce: string = /nonce-([^']+)'/.exec(page)?.[1] ?? ''
    assert.ok(nonce.length > 10)
    assert.match(page, /<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-[^']+' http:\/\/127\.0\.0\.1:5000 /)
    assert.match(page, /<base href="http:\/\/127\.0\.0\.1:5000\/">/)
    assert.ok(page.includes(`<script nonce="${nonce}" type="module">`))
    assert.ok(page.includes('id="warpengine-start"') && page.includes('id="warpengine-toolbar"') && page.includes("postMessage({ type: 'ready' })"))
    assert.equal((page.match(/<script(?![^>]*nonce=)/g) ?? []).length, 0)
  })

  it('runs the host page in a browser tab from the local server, handing the build over from the same origin', () => {
    const page: string = RENDERER.browser(HOST_PAGE, '/main.prg', 'main.prg')
    assert.match(page, /<head><base href="\/"><style>/)
    assert.ok(page.includes('id="warpengine-start"'))
    assert.ok(page.includes('{"path":"/main.prg","name":"main.prg"}'))
    assert.match(page, /window\.postMessage\(\{ type: 'warpengine\.payload', name: handoff\.name, data \}/)
    assert.ok(!page.includes('acquireVsCodeApi'))
  })
})
