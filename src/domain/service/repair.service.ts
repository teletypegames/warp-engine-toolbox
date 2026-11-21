/**
 * Why the current host does not answer, and the steps on the local engine that put it right.
 *
 * @module
 */
import type { Host } from '../model/host.model'
import { LocalEngine } from '../model/local-engine.model'
import type { HostDiagnosis } from '../model/repair.model'
import { Servers, type ServerContainer } from '../model/server.model'
import type { ContainerRuntime, DockerAvailability } from '../repository/container-runtime.repository'
import type { DiscoveryRepository } from '../repository/discovery.repository'
import type { LocalEngineRepository } from '../repository/local-engine.repository'
import type { HostService } from './host.service'

/** What {@link RepairService} works with. */
export interface RepairDependencies {
  /** The current host. */
  readonly hosts: HostService
  /** Probes an address for a WarpEngine. */
  readonly discovery: DiscoveryRepository
  /** The local engine's installation: port, data folder, saved answers. */
  readonly local: LocalEngineRepository
  /** Docker. */
  readonly runtime: ContainerRuntime
  /** Tells whether this window runs in a dev container (where there is no Docker to ask). */
  readonly inside: () => boolean
}

/** Waits a number of milliseconds; the tests give one that does not wait. */
export type Sleep = (ms: number) => Promise<void>

const POLL_MS = 2000

/** Finds why the current host does not answer and waits for Docker or the engine to come up. */
export class RepairService {
  /**
   * Creates the service.
   *
   * @param deps - The host, the probe, the installation and Docker.
   * @param sleep - Waits between two polls.
   */
  public constructor(private readonly deps: RepairDependencies, private readonly sleep: Sleep = async (ms: number) => new Promise((done: () => void) => { setTimeout(done, ms) })) {}

  /**
   * Finds the state of the current host: whether it answers, and when it is the local engine (a loopback address)
   * that does not, what is wrong with it on this machine — Docker, the containers, the address.
   *
   * @returns The diagnosis.
   */
  public async diagnose(): Promise<HostDiagnosis> {
    const host: Host | null = this.deps.hosts.current()
    if (!host) return { kind: 'noHost' }
    const url: string = host.url
    if (await this.deps.discovery.probe(url)) return { kind: 'answers', url }
    if (!LocalEngine.isLoopback(url)) return { kind: 'remote', url }
    if (this.deps.inside()) return { kind: 'inside', url }
    return this.diagnoseLocal(url)
  }

  /**
   * Tells whether the current host is (or would be) the local engine: its address is a loopback one.
   *
   * @returns `true` for a loopback host.
   */
  public isLocalHost(): boolean {
    return LocalEngine.isLoopback(this.deps.hosts.current()?.url ?? '')
  }

  /**
   * Finds the installation's data folder, which a purge removes when no engine container names it.
   *
   * @returns The folder, or `null` when there is none.
   */
  public async dataFolder(): Promise<string | null> {
    return this.deps.local.dataFolder()
  }

  /**
   * Waits until Docker answers.
   *
   * @param timeoutMs - How long to wait at most.
   * @returns `true` when it answers in time.
   */
  public async waitForDocker(timeoutMs: number): Promise<boolean> {
    return this.poll(timeoutMs, async () => (await this.deps.runtime.availability()) === 'ok')
  }

  /**
   * Waits until the current host answers.
   *
   * @param timeoutMs - How long to wait at most.
   * @returns `true` when it answers in time.
   */
  public async waitForHost(timeoutMs: number): Promise<boolean> {
    return this.poll(timeoutMs, async () => (await this.deps.discovery.probe(this.deps.hosts.current()?.url ?? '')) !== null)
  }

  private async diagnoseLocal(url: string): Promise<HostDiagnosis> {
    const docker: DockerAvailability = await this.deps.runtime.availability()
    if (docker === 'missing') return { kind: 'dockerMissing' }
    if (docker === 'down') return { kind: 'dockerDown' }
    const containers: ServerContainer[] = await this.deps.runtime.containers(Servers.LABEL).catch((): ServerContainer[] => [])
    if (!containers.some((container: ServerContainer) => Servers.role(container) === 'engine')) {
      return { kind: 'notInstalled', dataFolder: await this.deps.local.dataFolder(), configured: await this.deps.local.configured() }
    }
    const stopped: string[] = Servers.stopped(containers)
    if (stopped.length > 0) return { kind: 'stopped', containers: stopped }
    const installed: string = LocalEngine.urlFor((await this.deps.local.port()) ?? LocalEngine.DEFAULT_PORT)
    if (installed !== url && (await this.deps.discovery.probe(installed))) return { kind: 'elsewhere', url: installed }
    return { kind: 'notAnswering', url }
  }

  private async poll(timeoutMs: number, ready: () => Promise<boolean>): Promise<boolean> {
    for (let waited = 0; waited < timeoutMs; waited += POLL_MS) {
      if (await ready()) return true
      await this.sleep(POLL_MS)
    }
    return ready()
  }
}
