import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { HttpBuildRepository } from '../../../../src/infrastructure/http/build.http-repository'
import type { WarpEngineHttpClient } from '../../../../src/infrastructure/http/warp-engine.http-client'

describe('play preview URL', () => {
  const repository: HttpBuildRepository = new HttpBuildRepository({ baseUrl: 'https://games.example.org' } as unknown as WarpEngineHttpClient)

  it('sends the category, so a tool starts with the keyboard', () => {
    const url: URL = new URL(repository.playPreviewUrl({ platform: 'c64', title: 'Gate', params: null, start: null, binding: null, category: 'tool' }))
    assert.equal(url.pathname, '/play-preview/c64')
    assert.equal(url.searchParams.get('payload'), 'message')
    assert.equal(url.searchParams.get('category'), 'tool')
  })

  it('leaves the category out when the project has none', () => {
    const url: URL = new URL(repository.playPreviewUrl({ platform: 'c64', title: '', params: null, start: null, binding: 'vice', category: null }))
    assert.equal(url.pathname, '/play-preview/c64/vice')
    assert.equal(url.searchParams.has('category'), false)
  })
})
