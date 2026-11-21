import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { ForkOrigin } from '../../../../src/domain/model/fork.model'
import { MetadataDocument } from '../../../../src/domain/model/metadata-document.model'

const ORIGIN: ForkOrigin = { engine: 'https://teletypegames.org', name: 'rabbit', version: '1.2.0', repo: 'https://git.example/games/rabbit.git' }

describe('MetadataDocument.asFork', () => {
  it('renames a JSON document, drops repo and an earlier parent, and records the new parent flat', () => {
    const text = JSON.stringify({ name: 'rabbit', title: 'Rabbit', author: 'Ann', repo: 'https://git.example/games/rabbit', site: 'https://rabbit.example', fork_of: { engine: 'https://old', name: 'hare' }, fork_of_version: '0.1.0' })
    const values: Record<string, unknown> = JSON.parse(new MetadataDocument(text, 'json').asFork({ name: 'rabbit-bob', title: 'Rabbit Bob', origin: { ...ORIGIN, version: null } }) ?? '{}') as Record<string, unknown>
    assert.deepEqual(values, {
      name: 'rabbit-bob', title: 'Rabbit Bob', author: 'Ann', site: 'https://rabbit.example',
      fork_of_engine: 'https://teletypegames.org', fork_of_name: 'rabbit', fork_of_repo: 'https://git.example/games/rabbit.git'
    })
  })

  it('rewrites a Lua header line by line', () => {
    const text = '-- title: Rabbit\n-- name: rabbit\n-- repo: https://git.example/r\n-- author: Ann\nfunction TIC() end\n'
    const result: string | null = new MetadataDocument(text, 'lua').asFork({ name: 'rabbit-bob', title: 'Rabbit Bob', origin: ORIGIN })
    assert.equal(result, [
      '-- title: Rabbit Bob', '-- name: rabbit-bob', '-- author: Ann', '-- fork_of_engine: https://teletypegames.org', '-- fork_of_name: rabbit',
      '-- fork_of_version: 1.2.0', '-- fork_of_repo: https://git.example/games/rabbit.git', 'function TIC() end', ''
    ].join('\n'))
  })

  it('gives nothing for a custom format or broken JSON', () => {
    assert.equal(new MetadataDocument('x', 'custom').asFork({ name: 'a', title: 'A', origin: ORIGIN }), null)
    assert.equal(new MetadataDocument('{', 'json').asFork({ name: 'a', title: 'A', origin: ORIGIN }), null)
  })

  it('sets the licence', () => {
    assert.equal((JSON.parse(new MetadataDocument('{"name":"a"}', 'json').withLicense('MIT') ?? '{}') as { license?: string }).license, 'MIT')
    assert.equal(new MetadataDocument('-- name: a\n', 'lua').withLicense('MIT'), '-- name: a\n-- license: MIT\n')
  })
})
