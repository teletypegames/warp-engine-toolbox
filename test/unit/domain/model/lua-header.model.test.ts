import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { LuaHeader } from '../../../../src/domain/model/lua-header.model'
import { TIC80 } from '../../fixtures'

describe('LuaHeader', () => {
  const source = '-- title: Rabbit\n-- version: 1.0.0\n-- script: lua\nfunction TIC() end\n-- version: 9\n'

  it('reads the header up to the first line that is no comment', () => {
    assert.deepEqual(LuaHeader.parse(source).values(), { title: 'Rabbit', version: '1.0.0', script: 'lua' })
  })

  it('changes a value in place and adds a missing one at the end of the header', () => {
    assert.equal(LuaHeader.parse(source).with('version', '1.1.0').split('\n')[1], '-- version: 1.1.0')
    assert.equal(LuaHeader.parse(source).with('site', 'https://x').split('\n')[3], '-- site: https://x')
  })

  it('finds the Lua file a version command reads', () => {
    assert.equal(LuaHeader.fileFromCommand(TIC80.versionCommand), 'inc/meta/meta.header.lua')
    assert.equal(LuaHeader.fileFromCommand('cat VERSION'), null)
  })
})
