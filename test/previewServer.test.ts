import { strict as assert } from 'node:assert'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { PreviewServer } from '../src/infrastructure/previewServer'

describe('preview server', () => {
  const root: string = mkdtempSync(join(tmpdir(), 'warp-preview-'))
  writeFileSync(join(root, 'rabbit.prg'), Buffer.from([1, 8]))
  writeFileSync(join(root, 'index.html'), '<p>hi</p>')
  const server: PreviewServer = new PreviewServer()
  after(async () => { await server.close() })

  it('serves the folder on the loopback interface, open to any origin', async () => {
    const base: string = await server.serve(root)
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+\/$/)
    const payload: Response = await fetch(`${base}rabbit.prg`)
    assert.equal(payload.status, 200)
    assert.equal(payload.headers.get('access-control-allow-origin'), '*')
    assert.equal(payload.headers.get('cross-origin-resource-policy'), 'cross-origin')
    assert.deepEqual([...new Uint8Array(await payload.arrayBuffer())], [1, 8])
    const page: Response = await fetch(base)
    assert.equal(await page.text(), '<p>hi</p>')
  })

  it('serves nothing outside the folder', async () => {
    const base: string = await server.serve(root)
    assert.equal((await fetch(`${base}..%2F..%2Fetc%2Fpasswd`)).status, 403)
    assert.equal((await fetch(`${base}missing.prg`)).status, 404)
  })
})
