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
 * A project change redraws the project, catalog and health views, announces the schemas and refreshes the remote state; a remote
 * state change redraws the project view, redraws the catalog view when the project's software, pipeline or
 * releases changed (such as after a connect or a finished build), the health view and the Dashboard when those, the
 * latest run or the authorization changed, and offers the local CI or, to a new game, Connect; a session change redraws the catalog, sync and health
 * views and announces the MCP server; a host change forgets the host data and refreshes everything; a focused
 * window and a git change refresh or poll the remote state; a built branch and the end of
 * the `HEAD` run are announced.
 *
 * @param wiring - The objects to connect.
 * @returns The subscriptions, to dispose on deactivation.
 */
export function wireEvents(wiring: Wiring): Disposer[] {
  const { workspace: { projects, states, auth }, views, controllers, hostWatcher } = wiring
  const redrawCatalog: (state: RemoteState | null) => void = onKeyChange((state: RemoteState | null) => RemoteStates.catalogKey(state), () => { views.catalogTree.refresh() })
  const redrawHealth: (state: RemoteState | null) => void = onKeyChange((state: RemoteState | null) => RemoteStates.healthKey(state), () => { views.healthTree.refresh(); void views.dashboard.refresh() })
  return [
    projects.onDidChange(() => { views.projectTree.refresh(); views.catalogTree.refresh(); views.healthTree.refresh(); void views.dashboard.refresh(); views.schemas.announce(); void states.refresh() }),
    states.onDidChange((state: RemoteState | null) => { views.projectTree.refresh(); redrawCatalog(state); redrawHealth(state); void controllers.localCi.offer(state); void controllers.connect.offer(state) }),
    auth.onDidChangeSessions(() => { views.catalogTree.refresh(); views.syncTree.refresh(); views.healthTree.refresh(); void views.dashboard.refresh(); views.mcp.announce(); void states.refresh() }),
    hostWatcher.onDidChange(() => { wiring.hostInfo.forget(); views.schemas.forgetHost(); views.mcp.announce(); void controllers.refresh.refresh() }),
    vscode.window.onDidChangeWindowState((state: vscode.WindowState) => { if (state.focused) void states.refresh() }),
    new GitWatcher(() => { states.watch() }),
    states.onDidBuildBranch((state: RemoteState) => { void controllers.project.announceBranchBuild(state) }),
    states.onDidFinishRun((state: RemoteState) => { void controllers.project.announceRunEnd(state) })
  ]
}

function onKeyChange(keyOf: (state: RemoteState | null) => string, redraw: () => void): (state: RemoteState | null) => void {
  let last: string | null = null
  return (state: RemoteState | null): void => {
    const key: string = keyOf(state)
    if (key === '') return
    if (last !== null && key !== last) redraw()
    last = key
  }
}
