import { msg, type Message } from '../model/message.model'
import { Servers, type PurgePlan, type ServerContainer } from '../model/server.model'
import type { ContainerRuntime } from '../repository/container-runtime.repository'

export type PurgeReport = (message: Message) => void

export class ServerService {
  public constructor(private readonly runtime: ContainerRuntime) {}

  public async containers(): Promise<ServerContainer[]> {
    return Servers.sorted(await this.runtime.containers(Servers.LABEL))
  }

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
