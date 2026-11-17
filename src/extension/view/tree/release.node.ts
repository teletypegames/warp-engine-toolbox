import { AssetChecklist, type ChecklistEntry } from '../../../domain/model/asset-checklist.model'
import type { Release, ReleaseAsset } from '../../../domain/model/catalog.model'
import type { Platform } from '../../../domain/model/platform.model'
import { t, translate } from '../../ui/l10n'
import { TreeNode } from './tree.node'

export interface ReleaseData {
  readonly release: Release
  readonly name: string
  readonly platform: Platform | null
}

export class ReleaseNode {
  public static create(data: ReleaseData, playUrl: string | null): TreeNode {
    const checklist: AssetChecklist | null = data.platform ? new AssetChecklist(data.platform, data.release.assets) : null
    const missing: number = checklist?.missing ?? 0
    return new TreeNode(data.release.version, {
      description: ReleaseNode.description(data.release, missing), icon: missing > 0 ? 'warning' : 'package',
      context: 'release link', data,
      ...(playUrl ? { command: TreeNode.openUrl(playUrl) } : {}),
      load: (): TreeNode[] => [...ReleaseNode.checklistNodes(checklist), ...ReleaseNode.assetNodes(data.release)]
    })
  }

  private static description(release: Release, missing: number): string {
    const channel: string = release.channel && release.channel !== 'stable' ? `${release.channel} · ` : ''
    const missingText: string = missing > 0 ? ` · ${t('{0} missing', missing)}` : ''
    const sha: string = release.commitSha ? ` · ${release.commitSha.slice(0, 7)}` : ''
    return `${channel}${t('{0} assets', release.assets.length)}${missingText}${sha}`
  }

  private static checklistNodes(checklist: AssetChecklist | null): TreeNode[] {
    return (checklist?.entries ?? []).map((entry: ChecklistEntry) =>
      new TreeNode(`${AssetChecklist.mark(entry.state)} ${entry.kind}`, { description: entry.note ? translate(entry.note) : '' }))
  }

  private static assetNodes(release: Release): TreeNode[] {
    return release.assets.map((asset: ReleaseAsset) => new TreeNode(asset.kind, { description: asset.path.split('/').pop() ?? '', icon: 'file-binary' }))
  }
}
