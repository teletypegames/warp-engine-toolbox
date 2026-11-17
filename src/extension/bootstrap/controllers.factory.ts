import { CatalogController } from '../controller/catalog.controller'
import { ConnectController } from '../controller/connect.controller'
import { GameAnswersDialog } from '../controller/game-answers.dialog'
import { LinkController } from '../controller/link.controller'
import { NewGameController } from '../controller/new-game.controller'
import { ProjectController } from '../controller/project.controller'
import { RefreshController } from '../controller/refresh.controller'
import { ReleaseController } from '../controller/release.controller'
import { SignInController } from '../controller/sign-in.controller'
import type { Controllers, Services } from './container'
import type { Views, Workspace } from './views.factory'

export function createControllers(services: Services, workspace: Workspace, views: Views): Controllers {
  const { projects, states, hostController, auth } = workspace
  const refresh: RefreshController = new RefreshController(services.platforms, projects, states, views.catalogTree)
  const connect: ConnectController = new ConnectController(services.connect, projects, states)
  const dialog: GameAnswersDialog = new GameAnswersDialog(services.platforms, services.catalog, services.scaffold)
  return {
    refresh, connect, host: hostController, link: new LinkController(),
    signIn: new SignInController(services.connection, auth, refresh),
    release: new ReleaseController(services.release, projects, states),
    newGame: new NewGameController({ hosts: services.hosts, hostController, dialog, scaffold: services.scaffold, projects, connect }),
    project: new ProjectController({ projects, pipelines: services.pipelines, tasks: views.tasks, diagnostics: views.diagnostics, player: views.player, reports: views.reports }),
    catalog: new CatalogController({ catalog: services.catalog, pipelines: services.pipelines, projects, states, reports: views.reports, tree: views.catalogTree })
  }
}
