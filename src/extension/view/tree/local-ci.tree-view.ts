import { LocalCi, type LocalComponent } from '../../../domain/model/local-ci.model'
import type { LocalCiService } from '../../../domain/service/local-ci.service'
import { t } from '../../ui/l10n'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

const ICONS: Readonly<Record<LocalComponent['state'], string>> = {
  off: 'circle-outline', starting: 'sync', ready: 'pass-filled', stopped: 'debug-pause', failed: 'error', unavailable: 'circle-slash'
}

export class LocalCiTreeView implements TreeView {
  public constructor(private readonly localCi: LocalCiService) {}

  public async roots(): Promise<TreeNode[]> {
    if (!this.localCi.available()) return []
    return (await this.localCi.components()).map((component: LocalComponent) => LocalCiTreeView.node(component))
  }

  private static node(component: LocalComponent): TreeNode {
    const actions: string[] = [...LocalCi.actions(component)]
    if (component.state === 'ready' && component.role === 'forge') actions.push('open')
    return new TreeNode(component.label, {
      description: [LocalCiTreeView.state(component.state), component.message ?? ''].filter(Boolean).join(' · '),
      tooltip: [component.description, component.message ?? ''].filter(Boolean).join('\n'),
      icon: ICONS[component.state], context: ['component', ...actions].join(' '), data: component
    })
  }

  private static state(state: LocalComponent['state']): string {
    const texts: Record<LocalComponent['state'], string> = {
      off: t('off'), starting: t('starting'), ready: t('ready'), stopped: t('stopped'), failed: t('failed'), unavailable: t('unavailable')
    }
    return texts[state]
  }
}
