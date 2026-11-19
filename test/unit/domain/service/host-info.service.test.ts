import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Software } from '../../../../src/domain/model/catalog.model'
import type { WellKnown } from '../../../../src/domain/model/local-engine.model'
import { HostInfoService } from '../../../../src/domain/service/host-info.service'
import { HostService } from '../../../../src/domain/service/host.service'

function service(url: string, info: WellKnown | null): HostInfoService {
  const hosts: HostService = new HostService({ configuredUrl: () => url, configuredHosts: () => [], saveUrl: async () => Promise.resolve(), saveHosts: async () => Promise.resolve() })
  return new HostInfoService({ probe: async () => Promise.resolve(info) }, hosts)
}

const SOFTWARE = { id: 12, name: 'rabbit' } as Software
const LOCAL: WellKnown = { engine: 'warp-engine', version: '5.5.2', api: 2, name: 'Local', profile: 'local', signIn: [], adminApi: null, admin: true, sync: { inbound: false, target: null } }

describe('HostInfoService', () => {
  it('links the software\'s admin page when the host has an admin', async () => {
    assert.equal(await service('http://127.0.0.1:7470', LOCAL).adminUrl(SOFTWARE), 'http://127.0.0.1:7470/admin/softwares/12')
  })

  it('gives no link when the host says its admin is off', async () => {
    assert.equal(await service('http://127.0.0.1:7470', { ...LOCAL, admin: false }).adminUrl(SOFTWARE), null)
  })

  it('assumes /admin on a host that does not describe itself', async () => {
    assert.equal(await service('https://games.example.org/', null).adminUrl(SOFTWARE), 'https://games.example.org/admin/softwares/12')
  })
})
