import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { browserPage, runtimePage } from '../src/domain/playPages'

const HOST_PAGE = '<!doctype html><html><head><title>Rabbit</title></head><body><div id="game"></div><script type="module">const runtimeUrl = "/file/_runtimes/emulatorjs-4.2.3/"</script></body></html>'

describe('play pages', () => {
  it('runs the host page in the panel: CSP for the local server, base, nonced scripts, the toolbar and the start hint', () => {
    const page: string = runtimePage(HOST_PAGE, 'http://127.0.0.1:5000/', 'main.prg')
    const nonce: string = /nonce-([^']+)'/.exec(page)?.[1] ?? ''
    assert.ok(nonce.length > 10)
    assert.match(page, /<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-[^']+' http:\/\/127\.0\.0\.1:5000 /)
    assert.match(page, /<base href="http:\/\/127\.0\.0\.1:5000\/">/)
    assert.ok(page.includes(`<script nonce="${nonce}" type="module">`))
    assert.ok(page.includes('id="warpengine-start"') && page.includes('id="warpengine-toolbar"') && page.includes("postMessage({ type: 'ready' })"))
    assert.equal((page.match(/<script(?![^>]*nonce=)/g) ?? []).length, 0)
  })

  it('runs the host page in a browser tab from the local server, handing the build over from the same origin', () => {
    const page: string = browserPage(HOST_PAGE, '/main.prg', 'main.prg')
    assert.match(page, /<head><base href="\/"><style>/)
    assert.ok(page.includes('id="warpengine-start"'))
    assert.match(page, /fetch\("\/main\.prg"\)/)
    assert.match(page, /window\.postMessage\(\{ type: 'warpengine\.payload', name: "main\.prg", data \}/)
    assert.ok(!page.includes('acquireVsCodeApi'))
  })
})
