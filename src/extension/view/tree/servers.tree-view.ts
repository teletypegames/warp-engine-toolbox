/**
 * The Local Server view: the WarpEngine containers on this machine.
 *
 * @packageDocumentation
 */

import { Servers, type ServerContainer, type ServerRole } from '../../../domain/model/server.model'
import type { ServerService } from '../../../domain/service/server.service'
import { Dialogs } from '../../ui/dialogs'
import { t } from '../../ui/l10n'
import { RemedyDialog } from '../../ui/remedy.dialog'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

const ROLE_ICONS: Readonly<Record<ServerRole, string>> = { engine: 'server', git: 'git-merge', ci: 'server-process', agent: 'run-all', other: 'package' }

/**
 * The content of the Local Server view (`warpengine.servers`): the engine, git server, CI and agent containers with their state and ports; a click opens a running server's web page.
 */
export class ServersTreeView implements TreeView {
  /**
   * Creates the view.
   *
   * @param servers - Lists the containers.
   */
  public constructor(private readonly servers: ServerService) {}

  /**
   * Returns one node per container, or one that installs the local engine when there is none; sets the
   * `warpengine.hasServers` context key.
   *
   * @returns The nodes.
   */
  public async roots(): Promise<TreeNode[]> {
    const containers: ServerContainer[] = await this.servers.containers()
    await Dialogs.setContext('warpengine.hasServers', containers.length > 0)
    if (containers.length === 0) return [ServersTreeView.installNode()]
    return containers.map((container: ServerContainer) => ServersTreeView.node(container))
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
      ...(url ? { command: TreeNode.openUrl(url), context: 'link server' } : { context: 'server' })
    })
  }

  private static role(role: ServerRole): string {
    const texts: Record<ServerRole, string> = { engine: t('engine'), git: t('git server'), ci: t('CI'), agent: t('CI agent'), other: '' }
    return texts[role]
  }
}
