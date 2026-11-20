/**
 * The entry point of the extension: `activate` builds and registers everything, `deactivate` leaves it to the subscriptions.
 *
 * @packageDocumentation
 */

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
import type { TreeNode } from '../view/tree/tree.node'
import type { TreeProvider } from '../view/tree/tree.provider'
import { ViewOpener } from '../view/tree/view.opener'
import { HostWatcher } from '../workspace/host.watcher'
import { createServices, type Controllers, type Services } from './container'
import { createControllers } from './controllers.factory'
import type { Disposer } from './disposer'
import { wireEvents } from './events.wiring'
import type { ToolboxApi } from './toolbox.api'
import { createViews, type Views } from './views.factory'
import { createWorkspace, type Workspace } from './workspace.factory'

/**
 * Activates the toolbox.
 *
 * Creates the services, the workspace state, the views and the controllers; registers the tree views
 * (`warpengine.project`, `warpengine.catalog`, `warpengine.servers`, `warpengine.health`, `warpengine.sync`) with the
 * {@link extension/view/tree/view.opener!ViewOpener} that opens the collapsed ones when due, the metadata editor,
 * the Makefile task provider, the marker completion, hover and lens, the MCP server definition, the pipeline
 * status bar, the commands and the event wiring, all as subscriptions of the context. Then reads the projects,
 * looks for a local engine and sets the `warpengine.signedIn` context key.
 *
 * @param context - The extension context that owns the subscriptions.
 * @returns The {@link ToolboxApi} the integration tests drive.
 */
export async function activate(context: vscode.ExtensionContext): Promise<ToolboxApi> {
  const services: Services = createServices(context)
  const workspace: Workspace = createWorkspace(services)
  const views: Views = createViews(context, services, workspace)
  const controllers: Controllers = createControllers(context, services, workspace, views)
  const hostWatcher: HostWatcher = new HostWatcher(services.hosts)
  context.subscriptions.push(
    hostWatcher, workspace.projects, workspace.states, workspace.auth, ...disposables(views), ...registrations(context, services, workspace, views),
    ...wireEvents({ workspace, views, controllers, hostWatcher, hostInfo: services.hostInfo }),
    ...CommandRegistry.register(commandTable(controllers))
  )
  await workspace.projects.refresh()
  await controllers.localEngine.discover().catch(() => null)
  await Dialogs.setContext('warpengine.signedIn', (await services.connection.token(false)) !== null)
  return { ...workspace, ...views, platforms: services.platforms, hosts: services.hosts, scaffold: services.scaffold, sync: services.sync, signIn: services.signIn, localCi: services.localCi, servers: services.servers }
}

/** Deactivates the toolbox; the context subscriptions dispose everything, so it does nothing itself. */
export function deactivate(): void {
  /* the subscriptions dispose everything */
}

function disposables(views: Views): Disposer[] {
  return [views.projectTree, views.catalogTree, views.syncTree, views.serversTree, views.healthTree, views.schemas, views.diagnostics, views.player, views.reports, views.mcp]
}

function treeViews(context: vscode.ExtensionContext, services: Services, views: Views): Disposer[] {
  const create = (id: string, provider: TreeProvider): vscode.TreeView<TreeNode> => vscode.window.createTreeView(id, { treeDataProvider: provider })
  const catalog: vscode.TreeView<TreeNode> = create('warpengine.catalog', views.catalogTree)
  const servers: vscode.TreeView<TreeNode> = create('warpengine.servers', views.serversTree)
  const all: vscode.TreeView<TreeNode>[] = [create('warpengine.project', views.projectTree), catalog, servers, create('warpengine.health', views.healthTree), create('warpengine.sync', views.syncTree)]
  const opener: ViewOpener = new ViewOpener({
    views: all, catalog: { view: catalog, provider: views.catalogTree }, servers: { view: servers, provider: views.serversTree },
    containers: services.servers, memory: context.globalState
  })
  void opener.open()
  return [...all, ...opener.watch()]
}

function registrations(context: vscode.ExtensionContext, services: Services, workspace: Workspace, views: Views): Disposer[] {
  return [
    new PipelineStatusBar(workspace.states, services.localEngine, services.hostInfo),
    ...treeViews(context, services, views),
    vscode.window.registerCustomEditorProvider(METADATA_VIEW, new MetadataEditor(context.extensionUri, views.schemas, workspace.projects)),
    vscode.tasks.registerTaskProvider(TASK_TYPE, views.tasks),
    vscode.languages.registerCompletionItemProvider(MARKER_SELECTOR, new MarkerCompletionProvider(services.platforms), ':', ' '),
    vscode.languages.registerHoverProvider(MARKER_SELECTOR, new MarkerHoverProvider(services.platforms)),
    vscode.languages.registerCodeLensProvider(MARKER_SELECTOR, new MarkerLensProvider()),
    vscode.lm.registerMcpServerDefinitionProvider('warpengine', views.mcp)
  ]
}
