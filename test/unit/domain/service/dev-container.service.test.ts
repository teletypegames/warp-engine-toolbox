import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import type { DevContainerOutput, DevContainerRepository, DevContainerStart } from '../../../../src/domain/repository/dev-container.repository'
import { DevContainerService } from '../../../../src/domain/service/dev-container.service'
import { MemoryFiles } from '../../fakes'

class FakeContainers implements DevContainerRepository {
  public calls: string[] = []
  public constructor(public isInside: boolean = false, public upFails: boolean = false, public wasRunning: boolean = false) {}
  public inside(): boolean { return this.isInside }
  public async up(folder: string): Promise<DevContainerStart> {
    this.calls.push(`up ${folder}`)
    return this.upFails ? Promise.reject(new Error('no docker')) : Promise.resolve({ container: `id-${folder}`, started: !this.wasRunning })
  }
  public async exec(folder: string, command: readonly string[], output: DevContainerOutput): Promise<number> {
    this.calls.push(`exec ${folder} ${command.join(' ')}`)
    output('ok\n')
    return Promise.resolve(0)
  }
  public async build(folder: string): Promise<number> { this.calls.push(`build ${folder}`); return Promise.resolve(0) }
  public async stop(container: string): Promise<void> { this.calls.push(`stop ${container}`); return Promise.resolve() }
  public async socketMissing(): Promise<boolean> { return Promise.resolve(false) }
}

const FILES: MemoryFiles = new MemoryFiles({ '/games/rabbit/.devcontainer/devcontainer.json': '{}' })

describe('DevContainerService', () => {
  it('routes the commands of a project with a dev container through it, but not from inside one', async () => {
    assert.equal(await new DevContainerService(new FakeContainers(), FILES).routes('/games/rabbit'), true)
    assert.equal(await new DevContainerService(new FakeContainers(), FILES).routes('/games/other'), false)
    assert.equal(await new DevContainerService(new FakeContainers(true), FILES).routes('/games/rabbit'), false)
  })

  it('starts the container before the command and stops what it started', async () => {
    const containers: FakeContainers = new FakeContainers()
    const service: DevContainerService = new DevContainerService(containers, FILES)
    let shown = ''
    assert.equal(await service.run('/games/rabbit', ['make', 'build'], (text: string) => { shown += text }), 0)
    assert.equal(shown, 'ok\n')
    await service.stopStarted()
    await service.stopStarted()
    assert.deepEqual(containers.calls, ['up /games/rabbit', 'exec /games/rabbit make build', 'stop id-/games/rabbit'])
  })

  it('leaves a container running that it found running, such as a container window\'s', async () => {
    const containers: FakeContainers = new FakeContainers(false, false, true)
    const service: DevContainerService = new DevContainerService(containers, FILES)
    await service.run('/games/rabbit', ['make'], () => undefined)
    await service.stopStarted()
    assert.deepEqual(containers.calls, ['up /games/rabbit', 'exec /games/rabbit make'])
  })

  it('reports a container that does not start as exit code 1 with its reason', async () => {
    const containers: FakeContainers = new FakeContainers(false, true)
    let shown = ''
    assert.equal(await new DevContainerService(containers, FILES).run('/games/rabbit', ['make'], (text: string) => { shown += text }), 1)
    assert.equal(shown, 'no docker\n')
    assert.deepEqual(containers.calls, ['up /games/rabbit'])
  })
})
