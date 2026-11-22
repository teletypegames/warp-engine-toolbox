import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { DevContainer } from '../../../../src/domain/model/dev-container.model'

describe('DevContainer.browserUrl', () => {
  it('turns the computer loopback into its mapped form, which VS Code does not forward into the container', () => {
    assert.equal(DevContainer.browserUrl('http://127.0.0.1:7470/admin/softwares/3'), 'http://[::ffff:7f00:1]:7470/admin/softwares/3')
    assert.equal(DevContainer.browserUrl('http://localhost:7470/'), 'http://[::ffff:7f00:1]:7470/')
  })

  it('leaves other addresses and non-URLs alone', () => {
    assert.equal(DevContainer.browserUrl('https://teletypegames.org/admin'), 'https://teletypegames.org/admin')
    assert.equal(DevContainer.browserUrl('not a url'), 'not a url')
  })
})
