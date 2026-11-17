import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Version } from '../../../../src/domain/model/version.model'

describe('Version', () => {
  it('bumps each part', () => {
    assert.equal(new Version('1.2.3').bump('patch'), '1.2.4')
    assert.equal(new Version('v1.2.3').bump('minor'), '1.3.0')
    assert.equal(new Version('1.2.3-beta').bump('major'), '2.0.0')
    assert.equal(new Version('1.2').bump('patch'), '1.2.1')
  })

  it('compares numerically', () => {
    assert.ok(new Version('1.10.0').compare(new Version('1.9.0')) > 0)
    assert.equal(new Version('v1.0.0').compare(new Version('1.0.0')), 0)
  })

  it('reads the channel of a version', () => {
    assert.deepEqual(['1.2.0', '1.3.0-beta.1', '1.0-alpha', 'dev-1.2.0-x'].map((text: string) => new Version(text).channel), ['stable', 'beta', 'beta', 'dev'])
  })

  it('offers the next stable versions, finishing a pre-release first', () => {
    assert.deepEqual(new Version('1.2.3').stableCandidates(), ['1.2.4', '1.3.0', '2.0.0'])
    assert.deepEqual(new Version('1.3.0-beta.2').stableCandidates(), ['1.3.0', '1.3.1', '1.4.0', '2.0.0'])
  })

  it('offers the next beta: the next number of a running beta, or a first beta of the next versions', () => {
    assert.deepEqual(new Version('1.3.0-beta.2').betaCandidates(), ['1.3.0-beta.3'])
    assert.deepEqual(new Version('1.2.3').betaCandidates(), ['1.2.4-beta.1', '1.3.0-beta.1', '2.0.0-beta.1'])
  })

  it('reads the branch of a development build', () => {
    assert.equal(Version.devBuildBranch('dev-1.2.0-feature-x'), 'feature-x')
    assert.equal(Version.devBuildBranch('dev-3fb3ed8'), null)
  })

  it('accepts a release version and a pre-release only', () => {
    assert.equal(Version.isReleaseFormat('1.2.3-beta.1'), true)
    assert.equal(Version.isReleaseFormat('1.2'), false)
  })
})
