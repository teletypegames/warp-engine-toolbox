import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { DomainError } from '../../../../src/domain/model/message.model'
import { MetadataDocument } from '../../../../src/domain/model/metadata-document.model'
import { Metadata } from '../../../../src/domain/model/metadata.model'

describe('Metadata', () => {
  it('reads JSON and Lua headers, an invalid JSON as empty', () => {
    assert.equal(Metadata.parse('{"title":" Rabbit "}', 'json').trimmed('title'), 'Rabbit')
    assert.deepEqual(Metadata.parse('{', 'json').values, {})
    assert.equal(Metadata.parse('-- name: rabbit\n', 'lua').text('name'), 'rabbit')
    assert.deepEqual(Metadata.forCheck('-- name: rabbit\n-- script: lua\n', 'lua').values, { name: 'rabbit' })
  })
})

describe('MetadataDocument', () => {
  it('writes the version into JSON and into a Lua header', () => {
    assert.equal(new MetadataDocument('{"name":"r"}', 'json').withVersion('1.0.0'), '{\n  "name": "r",\n  "version": "1.0.0"\n}\n')
    assert.equal(new MetadataDocument('-- version: 0.1.0\n', 'lua').withVersion('1.0.0'), '-- version: 1.0.0\n')
  })

  it('records the repository, keeping a site of its own, and leaves broken JSON alone', () => {
    assert.equal(new MetadataDocument('{"site":"s"}', 'json').withRepository('https://r'), '{\n  "site": "s",\n  "repo": "https://r"\n}\n')
    assert.equal(new MetadataDocument('{', 'json').withRepository('https://r'), null)
  })

  it('sets and clears a nested field', () => {
    assert.equal(new MetadataDocument('{"web":{"start":"x"}}', 'json').withPath(['web', 'start'], ''), '{}\n')
    assert.throws(() => new MetadataDocument('{', 'json').withPath(['a'], 1), DomainError)
  })
})
