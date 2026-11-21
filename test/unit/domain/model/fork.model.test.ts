import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { ForkNames } from '../../../../src/domain/model/fork-name.model'
import { Forks, type PublicSoftware } from '../../../../src/domain/model/fork.model'
import { GitFailures } from '../../../../src/domain/model/git-failure.model'

const SOFTWARE: PublicSoftware = {
  name: 'rabbit', title: 'Rabbit', author: 'Ann', license: 'MIT', latestVersion: '1.2.0',
  source: { url: 'https://git.example/games/rabbit.git', sshUrl: 'git@git.example:games/rabbit.git', ref: null, public: true },
  forksAllowed: true, forkOf: null, forksCount: 2
}

describe('Forks', () => {
  it('offers Clone with a source and Fork only when the host allows it', () => {
    assert.equal(Forks.canClone(SOFTWARE), true)
    assert.equal(Forks.canFork(SOFTWARE), true)
    assert.equal(Forks.canFork({ ...SOFTWARE, forksAllowed: false }), false)
    assert.equal(Forks.canClone({ ...SOFTWARE, source: null }), false)
    assert.equal(Forks.canFork({ ...SOFTWARE, source: null }), false)
  })

  it('lists forks and asks for a licence by what the host sends', () => {
    assert.equal(Forks.listsForks(SOFTWARE), true)
    assert.equal(Forks.listsForks({ ...SOFTWARE, forksCount: null }), false)
    assert.equal(Forks.needsLicense(SOFTWARE), false)
    assert.equal(Forks.needsLicense({ ...SOFTWARE, license: ' ' }), true)
  })

  it('orders the addresses SSH first and recognises an SSH main address', () => {
    assert.deepEqual(Forks.addresses(SOFTWARE.source ?? { url: '', sshUrl: null, ref: null, public: null }).map((address) => address.protocol), ['SSH', 'HTTPS'])
    assert.deepEqual(Forks.addresses({ url: 'ssh://git@host/x.git', sshUrl: null, ref: null, public: null }), [{ protocol: 'SSH', url: 'ssh://git@host/x.git' }])
    assert.equal(Forks.isSsh('git@host:games/x.git'), true)
    assert.equal(Forks.isSsh('https://host/games/x.git'), false)
  })

  it('records the parent with its engine, latest release and source', () => {
    assert.deepEqual(Forks.originOf(SOFTWARE, 'https://teletypegames.org/'), {
      engine: 'https://teletypegames.org', name: 'rabbit', version: '1.2.0', repo: 'https://git.example/games/rabbit.git'
    })
  })
})

describe('ForkNames', () => {
  it('builds <name>-<user> from the principal label', () => {
    assert.equal(ForkNames.base('rabbit', 'Zsolt Tasnádi'), 'rabbit-zsolt-tasnadi')
    assert.equal(ForkNames.base('rabbit', 'ann@example.org'), 'rabbit-ann')
    assert.equal(ForkNames.base('rabbit', null), 'rabbit-fork')
    assert.equal(ForkNames.base('rabbit', '***'), 'rabbit-fork')
  })

  it('numbers the candidates from the second one', () => {
    assert.equal(ForkNames.numbered('rabbit-ann', 1), 'rabbit-ann')
    assert.equal(ForkNames.numbered('rabbit-ann', 3), 'rabbit-ann-3')
  })

  it('takes lower-case letters, digits and single dashes only', () => {
    assert.equal(ForkNames.isValid('rabbit-ann-2'), true)
    assert.equal(ForkNames.isValid('Rabbit'), false)
    assert.equal(ForkNames.isValid('rabbit--ann'), false)
    assert.equal(ForkNames.isValid('-rabbit'), false)
  })
})

describe('GitFailures', () => {
  it('classifies the error texts of git', () => {
    assert.equal(GitFailures.kind('fatal: could not read Username for \'https://git.example\': terminal prompts disabled'), 'auth')
    assert.equal(GitFailures.kind('git@host: Permission denied (publickey).'), 'auth')
    assert.equal(GitFailures.kind('remote: Repository not found.'), 'missing')
    assert.equal(GitFailures.kind('fatal: unable to access \'https://x/\': Could not resolve host: x'), 'unreachable')
    assert.equal(GitFailures.kind('something odd'), 'other')
  })

  it('gives a message with the address', () => {
    assert.equal(GitFailures.message('https://x/r.git', new Error('Could not resolve host: x')).args[0], 'https://x/r.git')
  })
})
