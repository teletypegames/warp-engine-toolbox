import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Marker } from '../../../../src/domain/model/marker.model'

describe('Marker', () => {
  it('reads the platform, the name and the options of a marker', () => {
    const marker: Marker = Marker.parse('# comment\nplatform: c64\nname: "rabbit"  # the software\nrelease: tag\n')
    assert.deepEqual({ platform: marker.platform, name: marker.name, options: marker.options }, { platform: 'c64', name: 'rabbit', options: { release: 'tag' } })
    assert.equal(Marker.isMarker('platform: c64\n'), true)
  })

  it('does not take a full pipeline for a marker', () => {
    assert.equal(Marker.isMarker('steps:\n  build:\n    image: x\n'), false)
    assert.equal(Marker.isMarker('platform: c64\nsteps:\n  a: 1\n'), false)
  })

  it('renders a marker with its preview comment', () => {
    assert.equal(Marker.render('c64', null, 'https://h/build/config?platform=c64'),
      '# One-line marker: the WarpEngine host serves the full pipeline. Preview it with:\n#   curl "https://h/build/config?platform=c64"\nplatform: c64\n')
  })
})
