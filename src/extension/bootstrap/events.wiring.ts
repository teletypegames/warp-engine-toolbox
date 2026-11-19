import * as vscode from 'vscode'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { PlayService } from '../../domain/service/play.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import { GitWatcher } from '../workspace/git.watcher'
import type { HostWatcher } from '../workspace/host.watcher'
import type { Controllers } from './container'
import type { Disposer } from './disposer'
import type { Views, Workspace } from './views.factory'

export interface Wiring {
  readonly workspace: Workspace
  readonly views: Views
  readonly controllers: Controllers
  readonly hostWatcher: HostWatcher
  readonly play: PlayService
}

export function wireEvents(wiring: Wiring): Disposer[] {
  const { workspace: { projects, states, auth }, views, controllers, hostWatcher } = wiring
  return [
    projects.onDidChange(() => { views.projectTree.refresh(); views.schemas.announce(); void states.refresh() }),
    states.onDidChange(() => { views.projectTree.refresh() }),
    auth.onDidChangeSessions(() => { views.catalogTree.refresh(); views.syncTree.refresh(); views.mcp.announce(); void states.refresh() }),
    hostWatcher.onDidChange(() => { views.schemas.forgetHost(); views.mcp.announce(); void controllers.refresh.refresh() }),
    vscode.window.onDidChangeWindowState((state: vscode.WindowState) => { if (state.focused) void states.refresh() }),
    new GitWatcher(() => { states.watch() }),
    states.onDidBuildBranch((state: RemoteState) => { announceBranchBuild(wiring.play, state) })
  ]
}

function announceBranchBuild(play: PlayService, state: RemoteState): void {
  const build = state.branchBuild
  const url: string | null = build ? play.playUrl(state.project.name, build.version) : null
  if (!build || !url) return
  const playAction: string = t('Play')
  const copy: string = t('Copy link')
  void Dialogs.ask(t('The build of {0} is ready: {1}', state.branch ?? t('this branch'), build.version), playAction, copy)
    .then(async (answer: string | undefined) => {
      if (answer === playAction) await Dialogs.openExternal(url)
      if (answer === copy) await vscode.env.clipboard.writeText(url)
    })
}
