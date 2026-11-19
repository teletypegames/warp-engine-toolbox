import type { SyncEvent } from '../../../domain/model/sync.model'
import type { SyncLink } from '../../../domain/model/sync.model'
import type { LocalEngineService } from '../../../domain/service/local-engine.service'
import type { SyncService } from '../../../domain/service/sync.service'
import { Dialogs } from '../../ui/dialogs'
import { t } from '../../ui/l10n'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

const STATUS_ICONS: Readonly<Record<SyncEvent['status'], string>> = {
  queued: 'clock', running: 'sync', succeeded: 'pass', failed: 'error', skipped: 'circle-slash'
}

export class SyncTreeView implements TreeView {
  public constructor(private readonly local: LocalEngineService, private readonly sync: SyncService) {}

  public async roots(): Promise<TreeNode[]> {
    const local: boolean = this.local.current() !== null
    await Dialogs.setContext('warpengine.localEngine', local)
    if (!local) return []
    const links: SyncLink[] = await this.sync.links()
    await Dialogs.setContext('warpengine.syncing', links.length > 0)
    return links.map((link: SyncLink) => this.linkNode(link))
  }

  private linkNode(link: SyncLink): TreeNode {
    const peer = link.peer
    const state: string = peer.lastError ? t('error') : peer.lastSyncedAt ? t('last sync {0}', SyncTreeView.time(peer.lastSyncedAt)) : t('nothing sent yet')
    return new TreeNode(peer.label, {
      description: `${link.channels.join(' + ')} · ${state}`, icon: peer.lastError ? 'warning' : 'cloud-upload', context: 'syncPeer', data: link,
      tooltip: [link.remoteUrl, peer.lastError ?? ''].filter(Boolean).join('\n'), expanded: true,
      load: async (): Promise<TreeNode[]> => {
        const events: SyncEvent[] = await this.sync.events(link)
        return events.length > 0 ? events.map((event: SyncEvent) => SyncTreeView.eventNode(event)) : [new TreeNode(t('No pushes yet.'), { icon: 'info' })]
      }
    })
  }

  private static eventNode(event: SyncEvent): TreeNode {
    const what: string = event.step === 'images' || event.step?.startsWith('image:') ? t('images') : (event.version ?? '')
    return new TreeNode(`${event.softwareName ?? '?'} ${what}`.trim(), {
      description: `${SyncTreeView.status(event.status)} · ${SyncTreeView.time(event.createdAt)}`, icon: STATUS_ICONS[event.status],
      tooltip: [event.step ?? '', event.message ?? ''].filter(Boolean).join('\n')
    })
  }

  private static status(status: SyncEvent['status']): string {
    const texts: Record<SyncEvent['status'], string> = {
      queued: t('queued'), running: t('running'), succeeded: t('sent'), failed: t('failed'), skipped: t('skipped')
    }
    return texts[status]
  }

  private static time(value: string | null): string {
    if (!value) return ''
    const date: Date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  }
}
