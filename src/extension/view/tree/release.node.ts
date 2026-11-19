/**
 * The tree node of a release, shared by the project and the catalog views.
 *
 * @packageDocumentation
 */

import { AssetChecklist, type ChecklistEntry } from '../../../domain/model/asset-checklist.model'
import type { Release, ReleaseAsset } from '../../../domain/model/catalog.model'
import type { Platform } from '../../../domain/model/platform.model'
import { t, translate } from '../../ui/l10n'
import { TreeNode } from './tree.node'

/** The data of a release node, for `warpengine.showChecklist` and `warpengine.deleteRelease`. */
export interface ReleaseData {
  /** The release. */
  readonly release: Release
  /** The name of its software. */
  readonly name: string
  /** The platform, for the asset checklist; `null` when the host does not describe it. */
  readonly platform: Platform | null
}

/** Builds release nodes. */
export class ReleaseNode {
  /**
   * Creates the node of a release: its version, channel, asset count, missing assets and commit; its children are the checklist and the assets. A click plays it.
   *
   * @param data - The release and its software.
   * @param playUrl - The play link; `null` for no click action.
   * @returns The node.
   */
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
