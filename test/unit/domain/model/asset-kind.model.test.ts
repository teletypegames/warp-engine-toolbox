import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { AssetKinds } from '../../../../src/domain/model/asset-kind.model'
import type { Release } from '../../../../src/domain/model/catalog.model'
import type { KindDescription, PlatformDescription } from '../../../../src/domain/model/platform-description.model'
import { C64_DESCRIPTION } from '../../fixtures'

describe('AssetKinds', () => {
  it('reads the cartridge of a host before api 6 as package', () => {
    assert.equal(AssetKinds.canonical('cartridge'), 'package')
    assert.equal(AssetKinds.canonical('package'), 'package')
    assert.equal(AssetKinds.canonical('win_x64'), 'win_x64')
  })

  it('translates the kinds and the web payload of an older platform description', () => {
    const kinds: KindDescription[] = C64_DESCRIPTION.kinds.map((kind: KindDescription) => kind.name === 'package' ? { ...kind, name: 'cartridge' } : kind)
    const old: PlatformDescription = {
      ...C64_DESCRIPTION,
      kinds,
      apps: [{ name: 'gui', default: true, marker: 'app: gui', kinds: kinds.slice(0, 1) }],
      web: C64_DESCRIPTION.web.map((binding) => ({ ...binding, payload: 'cartridge' }))
    }
    const platform = AssetKinds.platform(old)
    assert.deepEqual(platform.kinds.map((kind) => kind.name), ['package', 'win_x64', 'mac_arm64'])
    assert.deepEqual(platform.apps?.[0]?.kinds.map((kind) => kind.name), ['package'])
    assert.equal(platform.web[0]?.payload, 'package')
  })

  it('translates the asset kinds of a release', () => {
    const release = { id: 1, assets: [{ id: 2, kind: 'cartridge', path: '/x.prg' }, { id: 3, kind: 'html', path: '/x.zip' }] } as unknown as Release
    assert.deepEqual(AssetKinds.release(release).assets.map((asset) => asset.kind), ['package', 'html'])
  })
})
