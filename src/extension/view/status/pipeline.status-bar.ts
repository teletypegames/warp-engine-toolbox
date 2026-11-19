/**
 * The status bar item that follows the current project's pipeline.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { PipelineRuns, type PipelineRun } from '../../../domain/model/pipeline.model'
import { RemoteStates, type RemoteState } from '../../../domain/model/remote-state.model'
import { t } from '../../ui/l10n'
import type { RemoteStateStore } from '../../workspace/remote-state.store'
import { TreeNode } from '../tree/tree.node'

const PRIORITY = 50

/**
 * Shows the platform and name of the current project in the status bar with the state of its latest pipeline run; a click signs in, connects, refreshes or opens the run.
 */
export class PipelineStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem = vscode.window.createStatusBarItem('warpengine.pipeline', vscode.StatusBarAlignment.Left, PRIORITY)
  private readonly subscription: vscode.Disposable

  /**
   * Creates the item and redraws it on every remote state change.
   *
   * @param states - The remote state of the current project.
   */
  public constructor(states: RemoteStateStore) {
    this.item.name = t('WarpEngine pipeline')
    this.subscription = states.onDidChange((state: RemoteState | null) => { this.render(state) })
  }

  /** Stops listening and removes the item. */
  public dispose(): void {
    this.subscription.dispose()
    this.item.dispose()
  }

  private render(state: RemoteState | null): void {
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
    this.item.tooltip = state.software ? t('No pipeline is linked to this software') : t('Not on WarpEngine yet: Connect creates the repository, CI and catalog entry')
    this.item.command = state.software ? 'warpengine.refresh' : 'warpengine.connect'
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
