/**
 * The composition root of the services: the only file that creates infrastructure objects.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import type { PreviewRepository } from '../../domain/repository/preview.repository'
import type { FileSystemRepository } from '../../domain/repository/file-system.repository'
import type { SourceControlFactory } from '../../domain/repository/source-control.repository'
import { CatalogService } from '../../domain/service/catalog.service'
import { ConnectService } from '../../domain/service/connect.service'
import { ConnectionService } from '../../domain/service/connection.service'
import { DevContainerService } from '../../domain/service/dev-container.service'
import { HealthService } from '../../domain/service/health.service'
import { HostInfoService } from '../../domain/service/host-info.service'
import { HostService } from '../../domain/service/host.service'
import { ImageService } from '../../domain/service/image.service'
import { LocalCiService } from '../../domain/service/local-ci.service'
import { LocalEngineService } from '../../domain/service/local-engine.service'
import { MakeService } from '../../domain/service/make.service'
import { PipelineService } from '../../domain/service/pipeline.service'
import { PlatformService } from '../../domain/service/platform.service'
import { PlayService } from '../../domain/service/play.service'
import { ProjectService } from '../../domain/service/project.service'
import { PublishCheckService } from '../../domain/service/publish-check.service'
import { ReleaseService } from '../../domain/service/release.service'
import { RepairService } from '../../domain/service/repair.service'
import { RemoteStateService } from '../../domain/service/remote-state.service'
import { ScaffoldService } from '../../domain/service/scaffold.service'
import { ServerService } from '../../domain/service/server.service'
import { SignInService } from '../../domain/service/sign-in.service'
import { SyncService } from '../../domain/service/sync.service'
import { GitCliFactory } from '../../infrastructure/git/git.cli-repository'
import { HttpDiscoveryRepository } from '../../infrastructure/http/discovery.http-repository'
import { WarpEngineHttpGateway } from '../../infrastructure/http/warp-engine.http-gateway'
import { PreviewServer } from '../../infrastructure/preview/preview.server'
import { DockerContainerRuntime } from '../../infrastructure/process/container-runtime.docker-repository'
import { CliDevContainerRepository } from '../../infrastructure/process/dev-container.cli-repository'
import { ProcessShellRepository } from '../../infrastructure/process/shell.process-repository'
import { TarTemplateRepository } from '../../infrastructure/template/template.tar-repository'
import { VsCodeFileSystemRepository } from '../../infrastructure/vscode/file-system.vscode-repository'
import { ConfigHostRepository } from '../../infrastructure/vscode/host.config-repository'
import { VsCodeLocalEngineRepository } from '../../infrastructure/vscode/local-engine.vscode-repository'
import { MementoPlatformCacheRepository } from '../../infrastructure/vscode/platform-cache.memento-repository'
import { SecretSessionRepository } from '../../infrastructure/vscode/session.secret-repository'
import { AuthenticationTokenRepository } from '../../infrastructure/vscode/token.authentication-repository'
import { AUTH_PROVIDER_ID } from '../auth/warp-engine.auth-provider'
import type { CatalogController } from '../controller/catalog.controller'
import type { ConnectController } from '../controller/connect.controller'
import type { HostController } from '../controller/host.controller'
import type { ImageController } from '../controller/image.controller'
import type { LinkController } from '../controller/link.controller'
import type { LocalCiController } from '../controller/local-ci.controller'
import type { LocalEngineController } from '../controller/local-engine.controller'
import type { NewGameController } from '../controller/new-game.controller'
import type { ProjectController } from '../controller/project.controller'
import type { RefreshController } from '../controller/refresh.controller'
import type { ServersController } from '../controller/servers.controller'
import type { ReleaseController } from '../controller/release.controller'
import type { RepairController } from '../controller/repair.controller'
import type { ResetController } from '../controller/reset.controller'
import type { SignInController } from '../controller/sign-in.controller'
import type { SyncController } from '../controller/sync.controller'

/** Every domain service of the toolbox, built once by {@link "extension/bootstrap/container".createServices} on the infrastructure that implements its ports. */
export interface Services {
  /** The configured WarpEngine hosts and the current one. */
  readonly hosts: HostService
  /** Discovery of a WarpEngine running on this machine. */
  readonly localEngine: LocalEngineService
  /** The signed-in connection to the current host: token and HTTP repositories. */
  readonly connection: ConnectionService
  /** The host's platform descriptions, cached in the global state. */
  readonly platforms: PlatformService
  /** Reading WarpEngine projects from the workspace folders. */
  readonly projects: ProjectService
  /** New games and WarpEngine added to a project from the host's templates. */
  readonly scaffold: ScaffoldService
  /** Connect: the repository, the CI and the catalog entry on the host, the remote in the working copy. */
  readonly connect: ConnectService
  /** Release: version bump, changelog, commit, tag and push. */
  readonly release: ReleaseService
  /** What the host would refuse in the metadata on a publish. */
  readonly publishCheck: PublishCheckService
  /** The project's state on the host: software, pipeline, runs, releases. */
  readonly remoteState: RemoteStateService
  /** The plan and the payload of playing a build, and the play links. */
  readonly play: PlayService
  /** Signing in to a host and the stored sessions. */
  readonly signIn: SignInService
  /** The host's catalog: softwares, releases, links, pipelines, statistics. */
  readonly catalog: CatalogService
  /** The pipeline preview of a project and starting a pipeline. */
  readonly pipelines: PipelineService
  /** The Makefile targets of a project. */
  readonly make: MakeService
  /** The loopback HTTP server Play serves the build from. */
  readonly preview: PreviewRepository
  /** A software's image gallery on the host. */
  readonly images: ImageService
  /** Pairing the local engine with another WarpEngine instance and its sync links. */
  readonly sync: SyncService
  /** Setting a project up on the local engine's git server and CI. */
  readonly localCi: LocalCiService
  /** The WarpEngine containers on this machine and their purge. */
  readonly servers: ServerService
  /** What the current host tells about itself, such as a software's admin page. */
  readonly hostInfo: HostInfoService
  /** What is set up and what is not, for the Health view. */
  readonly health: HealthService
  /** The dev containers of the projects: where their commands run, and running them there. */
  readonly devContainers: DevContainerService
  /** Why the current host does not answer, and waiting for Docker or the engine. */
  readonly repair: RepairService
}

/** One controller per user flow, built by {@link "extension/bootstrap/controllers.factory".createControllers}; the command table maps the command ids to their methods. */
export interface Controllers {
  /** New Game… and Add WarpEngine to This Project. */
  readonly newGame: NewGameController
  /** Connect. */
  readonly connect: ConnectController
  /** Sign in, sign out and sign in again. */
  readonly signIn: SignInController
  /** Choosing the WarpEngine host. */
  readonly host: HostController
  /** The project panel actions: pipeline preview, Play, Build Like CI, Check Publish, metadata, platform docs. */
  readonly project: ProjectController
  /** Release…. */
  readonly release: ReleaseController
  /** Refresh of everything the toolbox shows. */
  readonly refresh: RefreshController
  /** Opening and copying links. */
  readonly link: LinkController
  /** The catalog view actions: fields, deletes, checklist, statistics, pipelines. */
  readonly catalog: CatalogController
  /** Finding and installing the local engine. */
  readonly localEngine: LocalEngineController
  /** Sync to… and the Sync view actions. */
  readonly sync: SyncController
  /** The image gallery actions of the catalog view. */
  readonly images: ImageController
  /** Set Up Local CI and its offer. */
  readonly localCi: LocalCiController
  /** Purge Local Engine…, and starting and stopping the dev containers. */
  readonly servers: ServersController
  /** Fix…, Start Docker and Start the Local Engine. */
  readonly repair: RepairController
  /** Reset…. */
  readonly reset: ResetController
}

interface Infrastructure {
  readonly files: FileSystemRepository
  readonly git: SourceControlFactory
}

/**
 * Creates every service on its infrastructure: the settings, the secret storage, the global state memento,
 * the workspace file system, the git and docker CLIs, the HTTP gateway and the preview server.
 *
 * @param context - The extension context; its global state caches the platforms and its secrets keep the sessions.
 * @returns The services, wired to each other.
 */
export function createServices(context: vscode.ExtensionContext): Services {
  const infrastructure: Infrastructure = { files: new VsCodeFileSystemRepository(), git: new GitCliFactory() }
  const hosts: HostService = new HostService(new ConfigHostRepository())
  const localEngine: LocalEngineService = new LocalEngineService(new HttpDiscoveryRepository(), new VsCodeLocalEngineRepository(), hosts)
  const connection: ConnectionService = new ConnectionService(hosts, new AuthenticationTokenRepository(AUTH_PROVIDER_ID), new WarpEngineHttpGateway())
  const platforms: PlatformService = new PlatformService(hosts, connection, new MementoPlatformCacheRepository(context.globalState))
  const projects: ProjectService = new ProjectService(infrastructure.files, platforms, new ProcessShellRepository())
  const remote: Pick<Services, 'remoteState' | 'play' | 'signIn' | 'catalog' | 'pipelines' | 'preview'> = remoteServices(context, infrastructure, connection)
  const sync: SyncService = new SyncService({ gateway: new WarpEngineHttpGateway(), discovery: new HttpDiscoveryRepository(), hosts, local: localEngine, signIn: remote.signIn })
  const localCi: LocalCiService = new LocalCiService({ gateway: new WarpEngineHttpGateway(), local: localEngine, sourceControl: infrastructure.git })
  const runtime: DockerContainerRuntime = new DockerContainerRuntime(dockerBinary)
  const servers: ServerService = new ServerService(runtime)
  const hostInfo: HostInfoService = new HostInfoService(new HttpDiscoveryRepository(), hosts)
  const project: Pick<Services, 'scaffold' | 'connect' | 'release' | 'publishCheck' | 'make'> = projectServices(infrastructure, connection, projects)
  const devContainers: DevContainerService = new DevContainerService(new CliDevContainerRepository({ cli: context.asAbsolutePath(DEV_CONTAINER_CLI), node: process.execPath, docker: dockerBinary }), infrastructure.files)
  return {
    hosts, localEngine, connection, platforms, projects, ...project, ...remote,
    images: new ImageService(connection), sync, localCi, servers, hostInfo, devContainers,
    repair: new RepairService({ hosts, discovery: new HttpDiscoveryRepository(), local: new VsCodeLocalEngineRepository(), runtime, inside: () => devContainers.inside() }),
    health: new HealthService({ hosts, hostInfo, connection, local: localEngine, servers, publishCheck: project.publishCheck, files: infrastructure.files })
  }
}

const DEV_CONTAINER_CLI = 'dist/devcontainer-cli/devcontainer.js'

function dockerBinary(): string {
  return vscode.workspace.getConfiguration('warpengine').get<string>('docker') ?? 'docker'
}

function projectServices(infrastructure: Infrastructure, connection: ConnectionService, projects: ProjectService): Pick<Services, 'scaffold' | 'connect' | 'release' | 'publishCheck' | 'make'> {
  const { files, git } = infrastructure
  return {
    scaffold: new ScaffoldService(new TarTemplateRepository(), files, git),
    connect: new ConnectService(connection, git, files),
    release: new ReleaseService({ sourceControl: git, files, connection, projects }),
    publishCheck: new PublishCheckService(connection, projects),
    make: new MakeService(files)
  }
}

function remoteServices(context: vscode.ExtensionContext, infrastructure: Infrastructure, connection: ConnectionService): Pick<Services, 'remoteState' | 'play' | 'signIn' | 'catalog' | 'pipelines' | 'preview'> {
  return {
    remoteState: new RemoteStateService(connection, infrastructure.git),
    play: new PlayService(infrastructure.files, connection),
    signIn: new SignInService(connection, new SecretSessionRepository(context.secrets)),
    catalog: new CatalogService(connection),
    pipelines: new PipelineService(connection, infrastructure.git),
    preview: new PreviewServer()
  }
}
