/**
 * The *Forks* node of a software in the catalog view, and its forks.
 *
 * @packageDocumentation
 */

import type { PublicSoftware, SoftwareFork } from '../../../domain/model/fork.model'
import { Forks } from '../../../domain/model/fork.model'
import { HostUrl } from '../../../domain/model/host.model'
import { t } from '../../ui/l10n'
import { TreeNode } from './tree.node'

/** Builds the fork nodes of the catalog view. */
export class ForkNode {
  /**
   * The words added to a software node's context for the Clone… and Fork… menu entries.
   *
   * @param software - The software from the public catalog, or `undefined` when the host did not list it.
   * @returns ` cloneable`, ` forkable`, both or neither.
   */
  public static context(software: PublicSoftware | undefined): string {
    if (!software) return ''
    return `${Forks.canClone(software) ? ' cloneable' : ''}${Forks.canFork(software) ? ' forkable' : ''}`
  }

  /**
   * The *Forks* node of a software, when its host lists forks: its children are the forks, each with the host it lives
   * on, the local ones marked; a click opens that host.
   *
   * @param software - The software from the public catalog, or `undefined`.
   * @param load - Lists the software's forks.
   * @returns The node in a list, or an empty list when the host lists no forks.
   */
  public static forks(software: PublicSoftware | undefined, load: (name: string) => Promise<SoftwareFork[]>): TreeNode[] {
    if (!software || !Forks.listsForks(software)) return []
    return [new TreeNode(t('Forks'), {
      description: String(software.forksCount ?? 0), icon: 'repo-forked',
      load: async (): Promise<TreeNode[]> => (await load(software.name)).map((fork: SoftwareFork) => ForkNode.fork(fork))
    })]
  }

  private static fork(fork: SoftwareFork): TreeNode {
    const host: string = HostUrl.nameOf(fork.engine)
    return new TreeNode(fork.title, {
      description: `${fork.name} · ${fork.local ? t('this engine') : host}`, icon: fork.local ? 'home' : 'repo-forked',
      tooltip: `${fork.engine} · ${fork.name}`, command: fork.engine ? TreeNode.openUrl(fork.engine) : undefined, context: 'link'
    })
  }
}
