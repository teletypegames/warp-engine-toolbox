/**
 * Creates the controllers, the last of the extension objects, on the services, the workspace state and the views.
 *
 * @packageDocumentation
 */

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
import { RepairController } from '../controller/repair.controller'
import { ServersController } from '../controller/servers.controller'
import { SignInController } from '../controller/sign-in.controller'
import { SyncController } from '../controller/sync.controller'
import { GameAnswersDialog } from '../ui/game-answers.dialog'
import type { Controllers, Services } from './container'
import type { Views } from './views.factory'
import type { Workspace } from './workspace.factory'

/**
 * Creates one controller per user flow and wires each to the services, stores and views it uses.
 *
 * @param context - The extension context; its global state remembers the local engine offer, its workspace state the declined local CI offers.
 * @param services - The services from {@link "extension/bootstrap/container".createServices}.
 * @param workspace - The workspace state from {@link "extension/bootstrap/workspace.factory".createWorkspace}; its host controller is reused.
 * @param views - The views from {@link "extension/bootstrap/views.factory".createViews}, which the controllers refresh and show.
 * @returns The controllers.
 */
export function createControllers(context: vscode.ExtensionContext, services: Services, workspace: Workspace, views: Views): Controllers {
  const { projects, states, hostController, auth } = workspace
  const localEngine: LocalEngineController = new LocalEngineController({ local: services.localEngine, hosts: services.hosts, connection: services.connection, state: context.globalState })
  const refresh: RefreshController = new RefreshController({ platforms: services.platforms, projects, states, trees: [views.catalogTree, views.syncTree, views.projectTree, views.serversTree, views.healthTree], localEngine, dashboard: views.dashboard })
  const connect: ConnectController = new ConnectController(services.connect, projects, states, { memory: context.globalState, local: services.localEngine })
  const dialog: GameAnswersDialog = new GameAnswersDialog(services.platforms, services.catalog, services.scaffold)
  const servers: ServersController = new ServersController({ servers: services.servers, local: services.localEngine, repair: services.repair, auth, localEngine, refresh })
  const repair: RepairController = new RepairController({ repair: services.repair, servers: services.servers, hosts: services.hosts, localEngine, purge: servers, refresh })
  localEngine.whenMissing((afterInstall: boolean) => { void repair.offer(afterInstall) })
  return {
    refresh, connect, localEngine, host: hostController, link: new LinkController(), servers, repair,
    sync: new SyncController({ sync: services.sync, hosts: services.hosts, tree: views.syncTree }),
    images: new ImageController(services.images, views.catalogTree),
    localCi: new LocalCiController({ localCi: services.localCi, memory: context.workspaceState, projects, states, tree: views.projectTree }),
    signIn: new SignInController(services.connection, auth, refresh),
    release: new ReleaseController(services.release, projects, states, services.localEngine),
    newGame: new NewGameController({ hosts: services.hosts, hostController, dialog, scaffold: services.scaffold, projects, connect, devContainers: services.devContainers }),
    project: new ProjectController({ projects, pipelines: services.pipelines, play: services.play, tasks: views.tasks, diagnostics: views.diagnostics, player: views.player, reports: views.reports, dashboard: views.dashboard }),
    catalog: new CatalogController({ catalog: services.catalog, pipelines: services.pipelines, projects, states, reports: views.reports, tree: views.catalogTree, local: services.localEngine })
  }
}
