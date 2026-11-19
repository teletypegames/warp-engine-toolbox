/**
 * Creates the living state of the window: the project registry, the remote state store, the host controller and the authentication provider.
 *
 * @packageDocumentation
 */

import { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import { HostController } from '../controller/host.controller'
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
}

/**
 * Creates the project registry, the remote state store, the host controller and the authentication provider.
 *
 * @param services - The services from {@link "extension/bootstrap/container".createServices}.
 * @returns The workspace state; the projects are read later by `activate`.
 */
export function createWorkspace(services: Services): Workspace {
  const projects: ProjectRegistry = new ProjectRegistry(services.projects)
  const hostController: HostController = new HostController(services.hosts)
  return {
    projects, hostController,
    states: new RemoteStateStore(services.remoteState, projects),
    auth: new WarpEngineAuthProvider(services.hosts, hostController, services.signIn, services.localEngine)
  }
}
