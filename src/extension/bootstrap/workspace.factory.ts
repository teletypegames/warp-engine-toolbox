import { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import { HostController } from '../controller/host.controller'
import { ProjectRegistry } from '../workspace/project.registry'
import { RemoteStateStore } from '../workspace/remote-state.store'
import type { Services } from './container'

export interface Workspace {
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly hostController: HostController
  readonly auth: WarpEngineAuthProvider
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
