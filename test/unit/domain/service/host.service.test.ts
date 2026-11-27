import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Host } from '../../../../src/domain/model/host.model'
import type { HostRepository } from '../../../../src/domain/repository/host.repository'
import { HostService } from '../../../../src/domain/service/host.service'

class MemoryHosts implements HostRepository {
  public url = ''
  public hosts: Host[] = []
  public configuredUrl(): string { return this.url }
  public configuredHosts(): Host[] { return this.hosts }
  public async saveUrl(url: string): Promise<void> { this.url = url; return Promise.resolve() }
  public async saveHosts(hosts: readonly Host[]): Promise<void> { this.hosts = [...hosts]; return Promise.resolve() }
}

function setup(): { repository: MemoryHosts, hosts: HostService } {
  const repository: MemoryHosts = new MemoryHosts()
  repository.hosts = [{ name: 'Games', url: 'https://games.example.org' }, { name: '127.0.0.1:7470', url: 'http://127.0.0.1:7470' }]
  repository.url = 'http://127.0.0.1:7470'
  return { repository, hosts: new HostService(repository) }
}

describe('HostService: changing and removing a host', () => {
  it('changes the address and the name, and the current host follows it', async () => {
    const { repository, hosts } = setup()

    await hosts.update('http://127.0.0.1:7470', 'http://127.0.0.1:7471/', 'Local')

    assert.deepEqual(repository.hosts, [{ name: 'Games', url: 'https://games.example.org' }, { name: 'Local', url: 'http://127.0.0.1:7471' }])
    assert.equal(repository.url, 'http://127.0.0.1:7471')
  })

  it('makes a name of the address when the new name is empty, and keeps the current host when another one changes', async () => {
    const { repository, hosts } = setup()

    await hosts.update('https://games.example.org', 'https://play.example.org', '  ')

    assert.equal(repository.hosts.find((host: Host) => host.url === 'https://play.example.org')?.name, 'play.example.org')
    assert.equal(repository.url, 'http://127.0.0.1:7470')
  })

  it('removes a host, and the current one leaves no host current', async () => {
    const { repository, hosts } = setup()

    await hosts.remove('https://games.example.org')
    assert.equal(repository.url, 'http://127.0.0.1:7470')
    await hosts.remove('http://127.0.0.1:7470')

    assert.deepEqual(repository.hosts, [])
    assert.equal(repository.url, '')
    assert.equal(hosts.current(), null)
  })

  it('has a local engine when a host is on a loopback address or one was found running here', () => {
    const repository: MemoryHosts = new MemoryHosts()
    repository.hosts = [{ name: 'Games', url: 'https://games.example.org' }]
    repository.url = 'https://games.example.org'
    const hosts: HostService = new HostService(repository)
    assert.equal(hosts.hasLocal(), false)
    hosts.setDiscovered([{ name: 'Local', url: 'http://127.0.0.1:7470' }])
    assert.equal(hosts.hasLocal(), true)
    hosts.setDiscovered([])
    repository.hosts.push({ name: 'Local', url: 'http://localhost:7470' })
    assert.equal(hosts.hasLocal(), true)
  })

  it('lets a configured or a current-only host be changed, not one only found on this machine', () => {
    const { repository, hosts } = setup()
    repository.url = 'https://other.example.org'
    hosts.setDiscovered([{ name: 'Local', url: 'http://127.0.0.1:7480' }])

    assert.equal(hosts.editable('https://games.example.org'), true)
    assert.equal(hosts.editable('https://other.example.org'), true)
    assert.equal(hosts.editable('http://127.0.0.1:7480'), false)
  })
})
