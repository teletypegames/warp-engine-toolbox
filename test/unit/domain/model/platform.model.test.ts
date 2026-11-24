import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { FilePath } from '../../../../src/domain/model/path.model'
import { Platform } from '../../../../src/domain/model/platform.model'
import { C64, C64_DESCRIPTION, TIC80 } from '../../fixtures'

describe('Platform', () => {
  it('reads the tooling the host gives', () => {
    assert.equal(C64.docsUrl, 'https://wiki.example/platforms/c64')
    assert.equal(TIC80.docsUrl, null)
    assert.equal(C64.toolingRef, 'master')
    assert.deepEqual(C64.recommendedExtensions, ['rosc.vs64'])
  })

  it('finds the default web binding and the payload extension of a kind', () => {
    assert.equal(C64.defaultBinding()?.runtime, 'emulatorjs')
    assert.equal(C64.payloadExtension('cartridge'), '.prg')
    assert.equal(C64.payloadExtension('win_x64'), null)
  })
})

describe('FilePath', () => {
  it('joins, splits and relates paths with the separator of the folder', () => {
    assert.equal(FilePath.join('/a/b/', 'c/d.txt'), '/a/b/c/d.txt')
    assert.equal(FilePath.join('C:\\a', 'c/d.txt'), 'C:\\a\\c\\d.txt')
    assert.equal(FilePath.basename('/a/b/c.prg'), 'c.prg')
    assert.equal(FilePath.dirname('/a/b/c.prg'), '/a/b')
    assert.equal(FilePath.relative('/a', '/a/dist/index.html'), 'dist/index.html')
  })
})

describe('Platform variants and marker options', () => {
  it('gives the variants with the default first and the marker options the host describes', () => {
    const kinds = C64.kinds
    const golang: Platform = new Platform({
      ...C64_DESCRIPTION, name: 'golang',
      apps: [{ name: 'gui', default: false, marker: 'app: gui', kinds }, { name: 'cli', default: true, marker: 'app: cli', kinds }],
      options: [{ name: 'app', values: ['cli', 'gui'], description: 'The kind of program' }]
    })
    assert.deepEqual(golang.apps.map((app) => app.name), ['cli', 'gui'])
    assert.deepEqual(golang.markerOptions?.map((option) => option.name), ['app'])
    assert.deepEqual(C64.apps, [])
    assert.equal(C64.markerOptions, null)
  })
})
