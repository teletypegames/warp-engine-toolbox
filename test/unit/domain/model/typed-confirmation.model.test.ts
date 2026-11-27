import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { TypedConfirmation } from '../../../../src/domain/model/typed-confirmation.model'

describe('TypedConfirmation', () => {
  const confirmation: TypedConfirmation = new TypedConfirmation('blessingofra')

  it('confirms the exact slug, with the surrounding spaces cut', () => {
    assert.equal(confirmation.matches('blessingofra'), true)
    assert.equal(confirmation.matches('  blessingofra '), true)
  })

  it('refuses anything else: another case, a prefix, the title, nothing', () => {
    assert.equal(confirmation.matches('BlessingOfRa'), false)
    assert.equal(confirmation.matches('blessing'), false)
    assert.equal(confirmation.matches('Blessing of Ra'), false)
    assert.equal(confirmation.matches(''), false)
    assert.equal(confirmation.matches(undefined), false)
  })

  it('never confirms an empty name', () => {
    assert.equal(new TypedConfirmation('').matches(''), false)
  })
})
