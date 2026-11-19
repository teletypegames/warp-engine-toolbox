import * as vscode from 'vscode'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { HostInfoService } from '../../domain/service/host-info.service'
import { GitWatcher } from '../workspace/git.watcher'
import type { HostWatcher } from '../workspace/host.watcher'
import type { Controllers } from './container'
import type { Disposer } from './disposer'
import type { Views } from './views.factory'
import type { Workspace } from './workspace.factory'

export interface Wiring {
  readonly workspace: Workspace
  readonly views: Views
  readonly controllers: Controllers
  readonly hostWatcher: HostWatcher
  readonly hostInfo: HostInfoService
}

export function wireEvents(wiring: Wiring): Disposer[] {
  const { workspace: { projects, states, auth }, views, controllers, hostWatcher } = wiring
  return [
    projects.onDidChange(() => { views.projectTree.refresh(); views.schemas.announce(); void states.refresh() }),
    states.onDidChange((state: RemoteState | null) => { views.projectTree.refresh(); void controllers.localCi.offer(state) }),
    auth.onDidChangeSessions(() => { views.catalogTree.refresh(); views.syncTree.refresh(); views.mcp.announce(); void states.refresh() }),
    hostWatcher.onDidChange(() => { wiring.hostInfo.forget(); views.schemas.forgetHost(); views.mcp.announce(); void controllers.refresh.refresh() }),
    vscode.window.onDidChangeWindowState((state: vscode.WindowState) => { if (state.focused) void states.refresh() }),
    new GitWatcher(() => { states.watch() }),
    states.onDidBuildBranch((state: RemoteState) => { void controllers.project.announceBranchBuild(state) })
  ]
}
