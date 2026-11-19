import type * as vscode from 'vscode'
import { CatalogController } from '../controller/catalog.controller'
import { ConnectController } from '../controller/connect.controller'
import { ImageController } from '../controller/image.controller'
import { LinkController } from '../controller/link.controller'
import { LocalCiController } from '../controller/local-ci.controller'
import { LocalEngineController } from '../controller/local-engine.controller'
import { NewGameController } from '../controller/new-game.controller'
import { ProjectController } from '../controller/project.controller'
import { RefreshController } from '../controller/refresh.controller'
import { ReleaseController } from '../controller/release.controller'
import { ServersController } from '../controller/servers.controller'
import { SignInController } from '../controller/sign-in.controller'
import { SyncController } from '../controller/sync.controller'
import { GameAnswersDialog } from '../ui/game-answers.dialog'
import type { Controllers, Services } from './container'
import type { Views } from './views.factory'
import type { Workspace } from './workspace.factory'

export function createControllers(context: vscode.ExtensionContext, services: Services, workspace: Workspace, views: Views): Controllers {
  const { projects, states, hostController, auth } = workspace
  const localEngine: LocalEngineController = new LocalEngineController({ local: services.localEngine, hosts: services.hosts, connection: services.connection, state: context.globalState })
  const refresh: RefreshController = new RefreshController({ platforms: services.platforms, projects, states, trees: [views.catalogTree, views.syncTree, views.projectTree, views.serversTree], localEngine })
  const connect: ConnectController = new ConnectController(services.connect, projects, states)
  const dialog: GameAnswersDialog = new GameAnswersDialog(services.platforms, services.catalog, services.scaffold)
  return {
    refresh, connect, localEngine, host: hostController, link: new LinkController(),
    sync: new SyncController({ sync: services.sync, hosts: services.hosts, tree: views.syncTree }),
    images: new ImageController(services.images, views.catalogTree),
    localCi: new LocalCiController({ localCi: services.localCi, memory: context.workspaceState, projects, states, tree: views.projectTree }),
    servers: new ServersController({ servers: services.servers, local: services.localEngine, auth, localEngine, refresh }),
    signIn: new SignInController(services.connection, auth, refresh),
    release: new ReleaseController(services.release, projects, states),
    newGame: new NewGameController({ hosts: services.hosts, hostController, dialog, scaffold: services.scaffold, projects, connect }),
    project: new ProjectController({ projects, pipelines: services.pipelines, play: services.play, tasks: views.tasks, diagnostics: views.diagnostics, player: views.player, reports: views.reports }),
    catalog: new CatalogController({ catalog: services.catalog, pipelines: services.pipelines, projects, states, reports: views.reports, tree: views.catalogTree })
  }
}
