import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { DomainError, type Message } from '../../../../src/domain/model/message.model'
import { Servers, type ServerContainer } from '../../../../src/domain/model/server.model'
import type { ContainerRuntime, DockerObject } from '../../../../src/domain/repository/container-runtime.repository'
import { ServerService } from '../../../../src/domain/service/server.service'

function container(name: string, image: string, ports: number[] = []): ServerContainer {
  return { id: name, name, image, state: 'running', status: 'Up', hostPorts: ports, folder: null }
}

const DEV: ServerContainer[] = [
  { id: 'a', name: 'a', image: 'vsc-a', state: 'exited', status: 'Exited (0)', hostPorts: [], folder: '/games/a' },
  { id: 'b', name: 'b', image: 'vsc-b', state: 'running', status: 'Up', hostPorts: [], folder: '/games/b' }
]

class FakeRuntime implements ContainerRuntime {
  public readonly calls: string[] = []
  public list: ServerContainer[] = [
    container('warp-engine-local-woodpecker', 'woodpecker-server'), container('warp-engine-local', 'warp-engine-local:1.4.0', [7470]),
    container('warp-engine-local-gitea', 'gitea', [7471])
  ]
  public labels: string[] = []
  public failing = false
  public async availability(): Promise<'ok'> { return Promise.resolve('ok') }
  public async launchDesktop(): Promise<boolean> { return Promise.resolve(false) }
  public async restart(names: readonly string[]): Promise<void> { this.calls.push(`restart ${names.join(' ')}`); return Promise.resolve() }
  public async containers(label: string): Promise<ServerContainer[]> {
    this.labels.push(label)
    if (this.failing) return Promise.reject(new Error('spawn docker ENOENT'))
    return Promise.resolve(label === Servers.DEV_CONTAINER_LABEL ? DEV : this.list)
  }
  public async start(names: readonly string[]): Promise<void> { this.calls.push(`start ${names.join(' ')}`); return Promise.resolve() }
  public async stop(names: readonly string[]): Promise<void> { this.calls.push(`stop ${names.join(' ')}`); return Promise.resolve() }
  public async volumes(): Promise<string[]> { return Promise.resolve(['warp-engine-local-gitea-data']) }
  public async networks(): Promise<string[]> { return Promise.resolve(['warp-engine-local']) }
  public async images(): Promise<string[]> { return Promise.resolve(['warp-engine-local:1.4.0', 'warp-engine-local:1.3.0']) }
  public async mountSource(): Promise<string | null> { return Promise.resolve('/home/dev/.warpengine') }
  public async remove(kind: DockerObject, names: readonly string[]): Promise<void> { this.calls.push(`${kind} ${names.join(' ')}`); return Promise.resolve() }
  public async wipeFolder(path: string, image: string | null): Promise<void> { this.calls.push(`wipe ${path} with ${image ?? 'no image'}`); return Promise.resolve() }
}

describe('ServerService', () => {
  it('lists the dev containers by their label, running ones first, and stops one', async () => {
    const runtime: FakeRuntime = new FakeRuntime()
    const service: ServerService = new ServerService(runtime)
    assert.deepEqual((await service.devContainers()).map((item: ServerContainer) => item.folder), ['/games/b', '/games/a'])
    assert.deepEqual(runtime.labels, [Servers.DEV_CONTAINER_LABEL])
    await service.stopDevContainer('b')
    await service.startDevContainer('a')
    assert.deepEqual(runtime.calls, ['stop b', 'start a'])
  })

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

  it('purges the data folder of an installation whose containers are gone', async () => {
    const runtime: FakeRuntime = new FakeRuntime()
    runtime.list = []
    const service: ServerService = new ServerService(runtime)
    const plan = await service.purgePlan('/home/dev/.warpengine')

    assert.equal(plan.dataFolder, '/home/dev/.warpengine')
    assert.equal(Servers.isEmpty(plan), false)
    await service.purge(plan, () => undefined)
    assert.ok(runtime.calls.includes('wipe /home/dev/.warpengine with no image'))
  })

  it('starts only the stopped WarpEngine containers', async () => {
    const runtime: FakeRuntime = new FakeRuntime()
    runtime.list = [container('warp-engine-local', 'e'), { ...container('warp-engine-local-gitea', 'g'), state: 'exited' }]

    assert.deepEqual(await new ServerService(runtime).startLocal(), ['warp-engine-local-gitea'])
    assert.deepEqual(runtime.calls, ['start warp-engine-local-gitea'])
  })

  it('offers Start Docker when Docker cannot be asked', async () => {
    const runtime: FakeRuntime = new FakeRuntime()
    runtime.failing = true

    await assert.rejects(new ServerService(runtime).containers(), (error: unknown) => error instanceof DomainError && error.remedy === 'startDocker')
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
