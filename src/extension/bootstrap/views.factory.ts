import * as vscode from 'vscode'
import { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import { HostController } from '../controller/host.controller'
import { MakeTaskProvider } from '../language/make.task-provider'
import { McpProvider } from '../language/mcp.provider'
import { MetadataSchemaProvider } from '../language/metadata-schema.provider'
import { PublishDiagnostics } from '../view/diagnostics/publish.diagnostics'
import { PlayRendererLoader } from '../view/play/play.assets'
import { PlayPanel } from '../view/play/play.panel'
import { ReportView } from '../view/report/report.view'
import { CatalogTreeView } from '../view/tree/catalog.tree-view'
import { ProjectTreeView } from '../view/tree/project.tree-view'
import { SyncTreeView } from '../view/tree/sync.tree-view'
import { TreeProvider } from '../view/tree/tree.provider'
import { ProjectRegistry } from '../workspace/project.registry'
import { RemoteStateStore } from '../workspace/remote-state.store'
import type { Services } from './container'

export interface Workspace {
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly hostController: HostController
  readonly auth: WarpEngineAuthProvider
}

export interface Views {
  readonly projectTree: TreeProvider
  readonly catalogTree: TreeProvider
  readonly syncTree: TreeProvider
  readonly schemas: MetadataSchemaProvider
  readonly diagnostics: PublishDiagnostics
  readonly tasks: MakeTaskProvider
  readonly player: PlayPanel
  readonly reports: ReportView
  readonly mcp: McpProvider
}

export function createWorkspace(services: Services): Workspace {
  const projects: ProjectRegistry = new ProjectRegistry(services.projects)
  const hostController: HostController = new HostController(services.hosts)
  return {
    projects, hostController,
    states: new RemoteStateStore(services.remoteState, projects),
    auth: new WarpEngineAuthProvider(services.hosts, hostController, services.signIn, services.localEngine)
  }
}

export function createViews(context: vscode.ExtensionContext, services: Services, workspace: Workspace): Views {
  const { projects, states } = workspace
  const tasks: MakeTaskProvider = new MakeTaskProvider(projects, services.make)
  return {
    tasks,
    projectTree: new TreeProvider(new ProjectTreeView({ hosts: services.hosts, projects, states, play: services.play, local: services.localEngine })),
    catalogTree: new TreeProvider(new CatalogTreeView({ hosts: services.hosts, catalog: services.catalog, platforms: services.platforms, play: services.play, images: services.images })),
    syncTree: new TreeProvider(new SyncTreeView(services.localEngine, services.sync)),
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
