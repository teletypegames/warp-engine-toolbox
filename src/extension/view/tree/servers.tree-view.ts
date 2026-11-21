/**
 * The Local Server view: the WarpEngine containers and the projects' dev containers on this machine.
 *
 * @packageDocumentation
 */

import { FilePath } from '../../../domain/model/path.model'
import { Servers, type ServerContainer, type ServerRole } from '../../../domain/model/server.model'
import type { DevContainerService } from '../../../domain/service/dev-container.service'
import type { ServerService } from '../../../domain/service/server.service'
import { Dialogs } from '../../ui/dialogs'
import { t } from '../../ui/l10n'
import { HostMachineDialog } from '../../ui/host-machine.dialog'
import { RemedyDialog } from '../../ui/remedy.dialog'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

const ROLE_ICONS: Readonly<Record<ServerRole, string>> = { engine: 'server', git: 'git-merge', ci: 'server-process', agent: 'run-all', other: 'package' }

/**
 * The content of the Local Server view (`warpengine.servers`): the engine, git server, CI and agent containers with their state and ports (a click opens a running server's web page, a stopped one has *Start*), then the dev containers of the projects, a running one with *Stop*, a stopped one with *Start*.
 */
export class ServersTreeView implements TreeView {
  /**
   * Creates the view.
   *
   * @param servers - Lists the containers.
   * @param devContainers - Tells whether this window runs in a dev container, where Docker answers only through a mounted socket.
   */
  public constructor(private readonly servers: ServerService, private readonly devContainers: DevContainerService) {}

  /**
   * Returns one node per WarpEngine container, or one that installs the local engine when there is none, then one
   * per dev container; sets the `warpengine.hasServers` context key (WarpEngine containers only). A dev container
   * reaches the computer's containers through its mounted Docker socket; one without it gets a single node saying so,
   * whose click reopens the folder on the computer.
   *
   * @returns The nodes.
   */
  public async roots(): Promise<TreeNode[]> {
    if (this.devContainers.inside() && (await this.servers.docker()) !== 'ok') {
      await Dialogs.setContext('warpengine.hasServers', false)
      return [new TreeNode(t('This dev container does not reach Docker'), { description: t('rebuild it from the current template, or open the folder on this computer'), icon: 'info', command: { title: HostMachineDialog.label(), command: 'remote-containers.reopenLocally' } })]
    }
    const containers: ServerContainer[] = await this.servers.containers()
    await Dialogs.setContext('warpengine.hasServers', containers.length > 0)
    const engine: TreeNode[] = containers.length === 0 ? [ServersTreeView.installNode()] : containers.map((container: ServerContainer) => ServersTreeView.node(container))
    const dev: ServerContainer[] = await this.servers.devContainers().catch(() => [])
    return [...engine, ...dev.map((container: ServerContainer) => ServersTreeView.devNode(container))]
  }

  private static devNode(container: ServerContainer): TreeNode {
    const running: boolean = container.state === 'running'
    return new TreeNode(container.folder ? FilePath.basename(container.folder) : container.name, {
      description: [t('dev container'), container.status].join(' · '),
      tooltip: [container.folder, container.image, container.status].filter(Boolean).join('\n'),
      icon: running ? 'vm-running' : 'vm-outline', context: running ? 'devcontainer running' : 'devcontainer', data: container.id
    })
  }

  private static installNode(): TreeNode {
    return new TreeNode(t('No WarpEngine container on this machine'), {
      description: RemedyDialog.label('installLocalEngine'), icon: 'cloud-download', command: RemedyDialog.command('installLocalEngine')
    })
  }

  private static node(container: ServerContainer): TreeNode {
    const url: string | null = Servers.url(container)
    const ports: string = container.hostPorts.map((port: number) => `:${String(port)}`).join(' ')
    return new TreeNode(container.name, {
      description: [ServersTreeView.role(Servers.role(container)), container.status, ports].filter(Boolean).join(' · '),
      tooltip: `${container.image}\n${container.status}`, icon: container.state === 'running' ? ROLE_ICONS[Servers.role(container)] : 'debug-stop',
      ...(url ? { command: TreeNode.openUrl(url), context: 'link server' } : { context: container.state === 'running' ? 'server' : 'server stopped' })
    })
  }

  private static role(role: ServerRole): string {
    const texts: Record<ServerRole, string> = { engine: t('engine'), git: t('git server'), ci: t('CI'), agent: t('CI agent'), other: '' }
    return texts[role]
  }
}
