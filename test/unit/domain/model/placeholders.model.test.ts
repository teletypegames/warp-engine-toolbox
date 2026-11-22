import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { GameAnswers } from '../../../../src/domain/model/game-answers.model'
import { Placeholders } from '../../../../src/domain/model/placeholders.model'

const ANSWERS: GameAnswers = { name: 'mystore', title: 'My Store', author: 'Studio', license: 'MIT', category: 'app', description: 'Our games', version: '0.1.0' }

describe('Placeholders', () => {
  const placeholders: Placeholders = new Placeholders(ANSWERS, 'https://games.example/')

  it('fills the answers and the catalog address, and leaves other braces alone', () => {
    assert.equal(placeholders.fill('{name} {title} {author} {description} {catalogUrl}/api/stores ${version} {x}'),
      'mystore My Store Studio Our games https://games.example/api/stores ${version} {x}')
  })

  it('fills the builder image a dev container builds on, empty when the platform has none', () => {
    assert.equal(new Placeholders(ANSWERS, 'h', 'registry/c64-builder:2026').fill('FROM {builderImage}'), 'FROM registry/c64-builder:2026')
    assert.equal(placeholders.fill('FROM {builderImage}'), 'FROM ')
  })

  it('sets dotted paths in a JSON document, creating what is missing, and fills the values', () => {
    const json: string = JSON.stringify({ name: 'we-desktop', version: '3.4.0', warpEngine: { registryUrl: 'https://ours/api/stores' } })
    const edited = JSON.parse(placeholders.edit(json, {
      name: '{name}',
      'warpEngine.registryUrl': '{catalogUrl}/api/stores',
      'warpEngine.brand': { name: '{title}', catalogUrl: '{catalogUrl}' },
      'build.appImage.artifactName': '{name}-${version}.${ext}'
    })) as Record<string, unknown>
    assert.deepEqual(edited, {
      name: 'mystore',
      version: '3.4.0',
      warpEngine: { registryUrl: 'https://games.example/api/stores', brand: { name: 'My Store', catalogUrl: 'https://games.example' } },
      build: { appImage: { artifactName: 'mystore-${version}.${ext}' } }
    })
  })
})
