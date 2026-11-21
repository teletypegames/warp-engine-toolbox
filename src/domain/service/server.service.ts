/**
 * The local WarpEngine containers: the Local Server view and Purge.
 *
 * @module
 */
import { msg, type Message } from '../model/message.model'
import { Servers, type PurgePlan, type ServerContainer } from '../model/server.model'
import type { ContainerRuntime } from '../repository/container-runtime.repository'

/** Receives each step of a purge, for the progress notification. */
export type PurgeReport = (message: Message) => void

/** Lists the local WarpEngine containers and removes everything they left behind. */
export class ServerService {
  /**
   * Creates the service.
   *
   * @param runtime - The local container runtime.
   */
  public constructor(private readonly runtime: ContainerRuntime) {}

  /**
   * Lists the containers labelled as WarpEngine Local components, running or not.
   *
   * @returns The containers in display order.
   * @throws When the container runtime fails.
   */
  public async containers(): Promise<ServerContainer[]> {
    return Servers.sorted(await this.runtime.containers(Servers.LABEL))
  }

  /**
   * Lists the dev containers of the projects on this machine (by the Dev Containers label), running or not.
   *
   * @returns The containers, each with its project folder, running ones first.
   * @throws When Docker fails.
   */
  public async devContainers(): Promise<ServerContainer[]> {
    const containers: ServerContainer[] = await this.runtime.containers(Servers.DEV_CONTAINER_LABEL)
    return containers.sort((a: ServerContainer, b: ServerContainer) => Number(b.state === 'running') - Number(a.state === 'running'))
  }

  /**
   * Starts a stopped dev container as it was created; it keeps running until it is stopped.
   *
   * @param container - The container name or id.
   */
  public async startDevContainer(container: string): Promise<void> {
    await this.runtime.start([container])
  }

  /**
   * Stops a dev container (such as one left running after the editor closed); it is kept for the next start.
   *
   * @param container - The container name or id.
   */
  public async stopDevContainer(container: string): Promise<void> {
    await this.runtime.stop([container])
  }

  /**
   * Collects what a purge would remove: the containers, their volumes, network and images (the engine image included), and the engine's data folder when it may be wiped. Removes nothing.
   *
   * @returns The plan to show the user.
   * @throws When the container runtime fails.
   */
  public async purgePlan(): Promise<PurgePlan> {
    const containers: ServerContainer[] = await this.containers()
    const engine: ServerContainer | undefined = containers.find((container: ServerContainer) => Servers.role(container) === 'engine')
    const images: string[] = [...containers.map((container: ServerContainer) => container.image), ...(await this.runtime.images(Servers.ENGINE_IMAGE))]
    return {
      containers, volumes: await this.runtime.volumes(Servers.LABEL),
      networks: await this.runtime.networks(Servers.LABEL),
      images: [...new Set(images)],
      dataFolder: engine ? Servers.wipeable(await this.runtime.mountSource(engine.name, Servers.DATA_MOUNT)) : null
    }
  }

  /**
   * Removes everything in a plan: the containers, the data folder (emptied through the engine
   * image), then the volumes, networks and images. Objects that fail to go are skipped.
   *
   * @param plan - The plan from {@link ServerService.purgePlan}.
   * @param report - Receives the steps.
   * @throws When the data folder cannot be wiped.
   */
  public async purge(plan: PurgePlan, report: PurgeReport): Promise<void> {
    report(msg('removing {0} containers…', plan.containers.length))
    await this.runtime.remove('container', plan.containers.map((container: ServerContainer) => container.name))
    const engineImage: string | undefined = plan.containers.find((container: ServerContainer) => Servers.role(container) === 'engine')?.image
    if (plan.dataFolder && engineImage) {
      report(msg('removing the data folder {0}…', plan.dataFolder))
      await this.runtime.wipeFolder(plan.dataFolder, engineImage)
    }
    report(msg('removing the volumes, the network and the images…'))
    await this.runtime.remove('volume', plan.volumes)
    await this.runtime.remove('network', plan.networks)
    await this.runtime.remove('image', plan.images)
  }
}
