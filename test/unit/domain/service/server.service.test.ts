import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { Message } from '../../../../src/domain/model/message.model'
import { Servers, type ServerContainer } from '../../../../src/domain/model/server.model'
import type { ContainerRuntime, DockerObject } from '../../../../src/domain/repository/container-runtime.repository'
import { ServerService } from '../../../../src/domain/service/server.service'

function container(name: string, image: string, ports: number[] = []): ServerContainer {
  return { id: name, name, image, state: 'running', status: 'Up', hostPorts: ports }
}

class FakeRuntime implements ContainerRuntime {
  public readonly calls: string[] = []
  public list: ServerContainer[] = [
    container('warp-engine-local-woodpecker', 'woodpecker-server'), container('warp-engine-local', 'warp-engine-local:1.4.0', [7470]),
    container('warp-engine-local-gitea', 'gitea', [7471])
  ]
  public async containers(): Promise<ServerContainer[]> { return Promise.resolve(this.list) }
  public async volumes(): Promise<string[]> { return Promise.resolve(['warp-engine-local-gitea-data']) }
  public async networks(): Promise<string[]> { return Promise.resolve(['warp-engine-local']) }
  public async images(): Promise<string[]> { return Promise.resolve(['warp-engine-local:1.4.0', 'warp-engine-local:1.3.0']) }
  public async mountSource(): Promise<string | null> { return Promise.resolve('/home/dev/.warpengine') }
  public async remove(kind: DockerObject, names: readonly string[]): Promise<void> { this.calls.push(`${kind} ${names.join(' ')}`); return Promise.resolve() }
  public async wipeFolder(path: string, image: string): Promise<void> { this.calls.push(`wipe ${path} with ${image}`); return Promise.resolve() }
}

describe('ServerService', () => {
  it('lists the engine first, then the git server and the CI', async () => {
    const names: string[] = (await new ServerService(new FakeRuntime()).containers()).map((item: ServerContainer) => item.name)

    assert.deepEqual(names, ['warp-engine-local', 'warp-engine-local-gitea', 'warp-engine-local-woodpecker'])
  })

  it('purges the containers, then the data with the engine image, then the volumes, network and images', async () => {
    const runtime: FakeRuntime = new FakeRuntime()
    const service: ServerService = new ServerService(runtime)
    const reported: Message[] = []

    await service.purge(await service.purgePlan(), (message: Message) => { reported.push(message) })

    assert.deepEqual(runtime.calls, [
      'container warp-engine-local warp-engine-local-gitea warp-engine-local-woodpecker',
      'wipe /home/dev/.warpengine with warp-engine-local:1.4.0',
      'volume warp-engine-local-gitea-data', 'network warp-engine-local',
      'image warp-engine-local:1.4.0 gitea woodpecker-server warp-engine-local:1.3.0'
    ])
    assert.equal(reported.length, 3)
  })

  it('never wipes a folder at the root', () => {
    assert.equal(Servers.wipeable('/'), null)
    assert.equal(Servers.wipeable('/data'), null)
    assert.equal(Servers.wipeable('/home/dev/.warpengine'), '/home/dev/.warpengine')
  })

  it('opens the engine on 127.0.0.1 and the git server on localhost', () => {
    assert.equal(Servers.url(container('warp-engine-local', 'x', [7470])), 'http://127.0.0.1:7470')
    assert.equal(Servers.url(container('warp-engine-local-gitea', 'x', [7471])), 'http://localhost:7471')
    assert.equal(Servers.url(container('warp-engine-local-woodpecker', 'x')), null)
  })
})
