/**
 * The status bar item that follows the current project's pipeline.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { PipelineRuns, type PipelineRun } from '../../../domain/model/pipeline.model'
import { RemoteStates, type RemoteState } from '../../../domain/model/remote-state.model'
import type { HostInfoService } from '../../../domain/service/host-info.service'
import type { LocalEngineService } from '../../../domain/service/local-engine.service'
import { t } from '../../ui/l10n'
import type { RemoteStateStore } from '../../workspace/remote-state.store'
import { TreeNode } from '../tree/tree.node'

const PRIORITY = 50

/**
 * Shows the platform and name of the current project in the status bar with the state of its latest pipeline run; a click
 * signs in, connects, sets up the local CI, opens the software's admin page (where a pipeline is linked) or opens the run.
 */
export class PipelineStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem = vscode.window.createStatusBarItem('warpengine.pipeline', vscode.StatusBarAlignment.Left, PRIORITY)
  private readonly subscription: vscode.Disposable
  private rendering = 0

  /**
   * Creates the item and redraws it on every remote state change.
   *
   * @param states - The remote state of the current project.
   * @param local - Tells whether the current host is the local engine.
   * @param hostInfo - Gives the admin page of a software.
   */
  public constructor(states: RemoteStateStore, private readonly local: LocalEngineService, private readonly hostInfo: HostInfoService) {
    this.item.name = t('WarpEngine pipeline')
    this.subscription = states.onDidChange((state: RemoteState | null) => { this.render(state) })
  }

  /** Stops listening and removes the item. */
  public dispose(): void {
    this.subscription.dispose()
    this.item.dispose()
  }

  private render(state: RemoteState | null): void {
    this.rendering += 1
    if (!state) {
      this.item.hide()
      return
    }
    const label = `${state.project.platformLabel} · ${state.project.name}`
    if (!state.signedIn) this.renderSignedOut(label)
    else if (!state.pipeline) this.renderUnlinked(label, state)
    else this.renderRun(label, state, RemoteStates.latestRun(state))
    this.item.show()
  }

  private renderSignedOut(label: string): void {
    this.item.text = `$(rocket) ${label}`
    this.item.tooltip = t('WarpEngine: sign in to see the pipeline')
    this.item.command = 'warpengine.signIn'
  }

  private renderUnlinked(label: string, state: RemoteState): void {
    this.item.text = `$(rocket) ${label}`
    if (this.local.isCurrentHost()) {
      this.item.tooltip = t('Not built here yet: Set up local CI puts it on the local git server and builds every push')
      this.item.command = 'warpengine.setupLocalCi'
    } else if (state.software) {
      this.item.tooltip = t('No pipeline is linked to this software')
      this.item.command = 'warpengine.refresh'
      void this.linkAdminPage(state)
    } else {
      this.item.tooltip = t('Not on WarpEngine yet: Connect creates the repository, CI and catalog entry')
      this.item.command = 'warpengine.connect'
    }
  }

  private async linkAdminPage(state: RemoteState): Promise<void> {
    const rendering: number = this.rendering
    const url: string | null = state.software ? await this.hostInfo.adminUrl(state.software).catch(() => null) : null
    if (!url || rendering !== this.rendering) return
    this.item.tooltip = t('No pipeline is linked to this software: link one on its admin page')
    this.item.command = TreeNode.openUrl(url)
  }

  private renderRun(label: string, state: RemoteState, run: PipelineRun | null): void {
    this.item.text = `${PipelineStatusBar.icon(run)} ${label}${run ? ` · ${run.status}` : ''}`
    this.item.tooltip = run ? PipelineStatusBar.tooltip(run, state.headRun !== null) : t('No runs yet')
    this.item.command = run?.url ? TreeNode.openUrl(run.url) : 'warpengine.refresh'
  }

  private static icon(run: PipelineRun | null): string {
    if (run === null) return '$(circle-outline)'
    if (PipelineRuns.isRunning(run)) return '$(sync~spin)'
    return PipelineRuns.isSuccess(run) ? '$(pass-filled)' : '$(error)'
  }

  private static tooltip(run: PipelineRun, ofHead: boolean): string {
    const head: string = ofHead ? '' : ` — ${t('not of the current commit')}`
    return `${t('Pipeline #{0}', run.number)} (${run.event ?? ''} ${run.branch ?? ''}) ${run.commit?.slice(0, 7) ?? ''}${head}`
  }
}
