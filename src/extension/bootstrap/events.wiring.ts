/**
 * Which store event redraws which view or starts which controller flow.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { RemoteStates, type RemoteState } from '../../domain/model/remote-state.model'
import type { HostInfoService } from '../../domain/service/host-info.service'
import { GitWatcher } from '../workspace/git.watcher'
import type { HostWatcher } from '../workspace/host.watcher'
import type { Controllers } from './container'
import type { Disposer } from './disposer'
import type { Views } from './views.factory'
import type { Workspace } from './workspace.factory'

/** The objects {@link wireEvents} connects. */
export interface Wiring {
  /** The project registry, the remote state store and the authentication provider whose events are listened to. */
  readonly workspace: Workspace
  /** The views the events redraw. */
  readonly views: Views
  /** The controllers whose flows the events start. */
  readonly controllers: Controllers
  /** Reports a change of the configured host. */
  readonly hostWatcher: HostWatcher
  /** Forgets what it knew about the host when the host changes. */
  readonly hostInfo: HostInfoService
}

/**
 * Subscribes the views and controllers to the events of the workspace state.
 *
 * A project change redraws the project view, announces the schemas and refreshes the remote state; a remote
 * state change redraws the project view, redraws the catalog view when the project's software, pipeline or
 * releases changed (such as after a connect or a finished build) and offers the local CI; a session change redraws the catalog and sync
 * views and announces the MCP server; a host change forgets the host data and refreshes everything; a focused
 * window and a git change refresh or poll the remote state; a built branch and the end of
 * the `HEAD` run are announced.
 *
 * @param wiring - The objects to connect.
 * @returns The subscriptions, to dispose on deactivation.
 */
export function wireEvents(wiring: Wiring): Disposer[] {
  const { workspace: { projects, states, auth }, views, controllers, hostWatcher } = wiring
  let catalogKey: string | null = null
  const redrawCatalog = (state: RemoteState | null): void => {
    const key: string = RemoteStates.catalogKey(state)
    if (catalogKey !== null && key !== '' && key !== catalogKey) views.catalogTree.refresh()
    if (key !== '') catalogKey = key
  }
  return [
    projects.onDidChange(() => { views.projectTree.refresh(); views.schemas.announce(); void states.refresh() }),
    states.onDidChange((state: RemoteState | null) => { views.projectTree.refresh(); redrawCatalog(state); void controllers.localCi.offer(state) }),
    auth.onDidChangeSessions(() => { views.catalogTree.refresh(); views.syncTree.refresh(); views.mcp.announce(); void states.refresh() }),
    hostWatcher.onDidChange(() => { wiring.hostInfo.forget(); views.schemas.forgetHost(); views.mcp.announce(); void controllers.refresh.refresh() }),
    vscode.window.onDidChangeWindowState((state: vscode.WindowState) => { if (state.focused) void states.refresh() }),
    new GitWatcher(() => { states.watch() }),
    states.onDidBuildBranch((state: RemoteState) => { void controllers.project.announceBranchBuild(state) }),
    states.onDidFinishRun((state: RemoteState) => { void controllers.project.announceRunEnd(state) })
  ]
}
