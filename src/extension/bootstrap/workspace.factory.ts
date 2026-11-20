/**
 * Creates the living state of the window: the project registry, the remote state store, the host controller and the authentication provider.
 *
 * @packageDocumentation
 */

import { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import { HostController } from '../controller/host.controller'
import type * as vscode from 'vscode'
import { KnownProjects } from '../workspace/known-projects'
import { ProjectRegistry } from '../workspace/project.registry'
import { RemoteStateStore } from '../workspace/remote-state.store'
import type { Services } from './container'

/** The living state of the window, built by {@link "extension/bootstrap/workspace.factory".createWorkspace}. */
export interface Workspace {
  /** The projects of the workspace folders and the current one. */
  readonly projects: ProjectRegistry
  /** The current project's state on the host, polled, with its events. */
  readonly states: RemoteStateStore
  /** Asks for the host when a flow needs one; shared with the authentication provider and the controllers. */
  readonly hostController: HostController
  /** The VS Code authentication provider of the WarpEngine hosts. */
  readonly auth: WarpEngineAuthProvider
  /** The folders of the projects ever opened, for the Dashboard's *Open* buttons. */
  readonly known: KnownProjects
}

/**
 * Creates the project registry, the remote state store, the host controller, the authentication provider and the
 * store of the known project folders.
 *
 * @param context - The extension context, whose global state keeps the known project folders.
 * @param services - The services from {@link "extension/bootstrap/container".createServices}.
 * @returns The workspace state; the projects are read later by `activate`.
 */
export function createWorkspace(context: vscode.ExtensionContext, services: Services): Workspace {
  const projects: ProjectRegistry = new ProjectRegistry(services.projects)
  const hostController: HostController = new HostController(services.hosts)
  return {
    projects, hostController, known: new KnownProjects(context.globalState),
    states: new RemoteStateStore(services.remoteState, projects),
    auth: new WarpEngineAuthProvider(services.hosts, hostController, services.signIn, services.localEngine)
  }
}
