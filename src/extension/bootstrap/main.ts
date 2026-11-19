import * as vscode from 'vscode'
import { commandTable } from '../command/command.table'
import { CommandRegistry } from '../command/command.registry'
import { TASK_TYPE } from '../language/make.task-provider'
import { MarkerCompletionProvider } from '../language/marker.completion-provider'
import { MarkerHoverProvider } from '../language/marker.hover-provider'
import { MarkerLensProvider } from '../language/marker.lens-provider'
import { MARKER_SELECTOR } from '../language/marker.selector'
import { Dialogs } from '../ui/dialogs'
import { METADATA_VIEW, MetadataEditor } from '../view/metadata/metadata.editor'
import { PipelineStatusBar } from '../view/status/pipeline.status-bar'
import { HostWatcher } from '../workspace/host.watcher'
import { createServices, type Controllers, type Services } from './container'
import { createControllers } from './controllers.factory'
import type { Disposer } from './disposer'
import { wireEvents } from './events.wiring'
import type { ToolboxApi } from './toolbox.api'
import { createViews, createWorkspace, type Views, type Workspace } from './views.factory'

export async function activate(context: vscode.ExtensionContext): Promise<ToolboxApi> {
  const services: Services = createServices(context)
  const workspace: Workspace = createWorkspace(services)
  const views: Views = createViews(context, services, workspace)
  const controllers: Controllers = createControllers(context, services, workspace, views)
  const hostWatcher: HostWatcher = new HostWatcher(services.hosts)
  context.subscriptions.push(
    hostWatcher, workspace.projects, workspace.states, workspace.auth, ...disposables(views), ...registrations(context, services, workspace, views),
    ...wireEvents({ workspace, views, controllers, hostWatcher, play: services.play }),
    ...CommandRegistry.register(commandTable(controllers))
  )
  await workspace.projects.refresh()
  await controllers.localEngine.discover().catch(() => null)
  await Dialogs.setContext('warpengine.signedIn', (await services.connection.token(false)) !== null)
  return { ...workspace, ...views, platforms: services.platforms, hosts: services.hosts, scaffold: services.scaffold, sync: services.sync, signIn: services.signIn }
}

export function deactivate(): void {
  /* the subscriptions dispose everything */
}

function disposables(views: Views): Disposer[] {
  return [views.projectTree, views.catalogTree, views.syncTree, views.schemas, views.diagnostics, views.player, views.reports, views.mcp]
}

function registrations(context: vscode.ExtensionContext, services: Services, workspace: Workspace, views: Views): Disposer[] {
  return [
    new PipelineStatusBar(workspace.states),
    vscode.window.registerTreeDataProvider('warpengine.project', views.projectTree),
    vscode.window.registerTreeDataProvider('warpengine.catalog', views.catalogTree),
    vscode.window.registerTreeDataProvider('warpengine.sync', views.syncTree),
    vscode.window.registerCustomEditorProvider(METADATA_VIEW, new MetadataEditor(context.extensionUri, views.schemas, workspace.projects)),
    vscode.tasks.registerTaskProvider(TASK_TYPE, views.tasks),
    vscode.languages.registerCompletionItemProvider(MARKER_SELECTOR, new MarkerCompletionProvider(services.platforms), ':', ' '),
    vscode.languages.registerHoverProvider(MARKER_SELECTOR, new MarkerHoverProvider(services.platforms)),
    vscode.languages.registerCodeLensProvider(MARKER_SELECTOR, new MarkerLensProvider()),
    vscode.lm.registerMcpServerDefinitionProvider('warpengine', views.mcp)
  ]
}
