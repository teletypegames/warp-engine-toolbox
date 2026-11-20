/**
 * Creates the views: the tree views, the schemas, the diagnostics, the tasks, the Play panel, the reports, the MCP server definition.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { MakeTaskProvider } from '../language/make.task-provider'
import { McpProvider } from '../language/mcp.provider'
import { MetadataSchemaProvider } from '../language/metadata-schema.provider'
import { PublishDiagnostics } from '../view/diagnostics/publish.diagnostics'
import { PlayRendererLoader } from '../view/play/play.assets'
import { PlayPanel } from '../view/play/play.panel'
import { ReportView } from '../view/report/report.view'
import { CatalogTreeView } from '../view/tree/catalog.tree-view'
import { ProjectTreeView } from '../view/tree/project.tree-view'
import { ServersTreeView } from '../view/tree/servers.tree-view'
import { SyncTreeView } from '../view/tree/sync.tree-view'
import { TreeProvider } from '../view/tree/tree.provider'
import type { Services } from './container'
import type { Workspace } from './workspace.factory'

/** Everything the toolbox draws, built by {@link "extension/bootstrap/views.factory".createViews}. */
export interface Views {
  /** The WarpEngine project view (`warpengine.project`) on a {@link ProjectTreeView}. */
  readonly projectTree: TreeProvider
  /** The catalog view (`warpengine.catalog`) on a {@link CatalogTreeView}. */
  readonly catalogTree: TreeProvider
  /** The Sync view (`warpengine.sync`) on a {@link SyncTreeView}. */
  readonly syncTree: TreeProvider
  /** The Local Server view (`warpengine.servers`) on a {@link ServersTreeView}. */
  readonly serversTree: TreeProvider
  /** The metadata JSON schemas from the host's platform descriptions. */
  readonly schemas: MetadataSchemaProvider
  /** The publish check problems on the metadata file. */
  readonly diagnostics: PublishDiagnostics
  /** The Makefile targets as VS Code tasks. */
  readonly tasks: MakeTaskProvider
  /** The Play panel. */
  readonly player: PlayPanel
  /** The read-only report documents (checklists, statistics, pipeline preview). */
  readonly reports: ReportView
  /** The host's Admin API as an MCP server definition. */
  readonly mcp: McpProvider
}

/**
 * Creates the views on the services and the workspace state.
 *
 * @param context - The extension context; its extension URI locates the Play assets.
 * @param services - The services from {@link "extension/bootstrap/container".createServices}.
 * @param workspace - The workspace state from {@link "extension/bootstrap/workspace.factory".createWorkspace}.
 * @returns The views, not registered yet: `activate` registers them.
 */
export function createViews(context: vscode.ExtensionContext, services: Services, workspace: Workspace): Views {
  const { projects, states } = workspace
  const tasks: MakeTaskProvider = new MakeTaskProvider(projects, services.make)
  return {
    tasks,
    projectTree: new TreeProvider(new ProjectTreeView({ hosts: services.hosts, projects, states, play: services.play, local: services.localEngine, hostInfo: services.hostInfo })),
    catalogTree: new TreeProvider(new CatalogTreeView({ hosts: services.hosts, catalog: services.catalog, platforms: services.platforms, play: services.play, images: services.images, projects })),
    syncTree: new TreeProvider(new SyncTreeView(services.localEngine, services.sync)),
    serversTree: new TreeProvider(new ServersTreeView(services.servers)),
    schemas: new MetadataSchemaProvider(services.hosts, services.connection, projects),
    diagnostics: new PublishDiagnostics(services.hosts, projects, services.publishCheck),
    reports: new ReportView(),
    mcp: new McpProvider(services.hosts, services.connection),
    player: new PlayPanel({
      hosts: services.hosts, projects, play: services.play, make: services.make, tasks,
      preview: services.preview, renderers: new PlayRendererLoader(context.extensionUri)
    })
  }
}
