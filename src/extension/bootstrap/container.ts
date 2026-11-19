import type * as vscode from 'vscode'
import type { PreviewRepository } from '../../domain/repository/preview.repository'
import type { FileSystemRepository } from '../../domain/repository/file-system.repository'
import type { SourceControlFactory } from '../../domain/repository/source-control.repository'
import { CatalogService } from '../../domain/service/catalog.service'
import { ConnectService } from '../../domain/service/connect.service'
import { ConnectionService } from '../../domain/service/connection.service'
import { HostService } from '../../domain/service/host.service'
import { ImageService } from '../../domain/service/image.service'
import { LocalEngineService } from '../../domain/service/local-engine.service'
import { MakeService } from '../../domain/service/make.service'
import { PipelineService } from '../../domain/service/pipeline.service'
import { PlatformService } from '../../domain/service/platform.service'
import { PlayService } from '../../domain/service/play.service'
import { ProjectService } from '../../domain/service/project.service'
import { PublishCheckService } from '../../domain/service/publish-check.service'
import { ReleaseService } from '../../domain/service/release.service'
import { RemoteStateService } from '../../domain/service/remote-state.service'
import { ScaffoldService } from '../../domain/service/scaffold.service'
import { SignInService } from '../../domain/service/sign-in.service'
import { SyncService } from '../../domain/service/sync.service'
import { GitCliFactory } from '../../infrastructure/git/git.cli-repository'
import { DiscoveryHttpRepository } from '../../infrastructure/http/discovery.http-repository'
import { WarpEngineHttpGateway } from '../../infrastructure/http/warp-engine.http-gateway'
import { PreviewServer } from '../../infrastructure/preview/preview.server'
import { ProcessShellRepository } from '../../infrastructure/process/shell.process-repository'
import { TarTemplateRepository } from '../../infrastructure/template/template.tar-repository'
import { VsCodeFileSystemRepository } from '../../infrastructure/vscode/file-system.vscode-repository'
import { ConfigHostRepository } from '../../infrastructure/vscode/host.config-repository'
import { LocalEngineVsCodeRepository } from '../../infrastructure/vscode/local-engine.vscode-repository'
import { MementoPlatformCacheRepository } from '../../infrastructure/vscode/platform-cache.memento-repository'
import { SecretSessionRepository } from '../../infrastructure/vscode/session.secret-repository'
import { AuthenticationTokenRepository } from '../../infrastructure/vscode/token.authentication-repository'
import { AUTH_PROVIDER_ID } from '../auth/warp-engine.auth-provider'
import type { CatalogController } from '../controller/catalog.controller'
import type { ConnectController } from '../controller/connect.controller'
import type { HostController } from '../controller/host.controller'
import type { ImageController } from '../controller/image.controller'
import type { LinkController } from '../controller/link.controller'
import type { LocalEngineController } from '../controller/local-engine.controller'
import type { NewGameController } from '../controller/new-game.controller'
import type { ProjectController } from '../controller/project.controller'
import type { RefreshController } from '../controller/refresh.controller'
import type { ReleaseController } from '../controller/release.controller'
import type { SignInController } from '../controller/sign-in.controller'
import type { SyncController } from '../controller/sync.controller'

export interface Services {
  readonly hosts: HostService
  readonly localEngine: LocalEngineService
  readonly connection: ConnectionService
  readonly platforms: PlatformService
  readonly projects: ProjectService
  readonly scaffold: ScaffoldService
  readonly connect: ConnectService
  readonly release: ReleaseService
  readonly publishCheck: PublishCheckService
  readonly remoteState: RemoteStateService
  readonly play: PlayService
  readonly signIn: SignInService
  readonly catalog: CatalogService
  readonly pipelines: PipelineService
  readonly make: MakeService
  readonly preview: PreviewRepository
  readonly images: ImageService
  readonly sync: SyncService
}

export interface Controllers {
  readonly newGame: NewGameController
  readonly connect: ConnectController
  readonly signIn: SignInController
  readonly host: HostController
  readonly project: ProjectController
  readonly release: ReleaseController
  readonly refresh: RefreshController
  readonly link: LinkController
  readonly catalog: CatalogController
  readonly localEngine: LocalEngineController
  readonly sync: SyncController
  readonly images: ImageController
}

interface Infrastructure {
  readonly files: FileSystemRepository
  readonly git: SourceControlFactory
}

export function createServices(context: vscode.ExtensionContext): Services {
  const infrastructure: Infrastructure = { files: new VsCodeFileSystemRepository(), git: new GitCliFactory() }
  const hosts: HostService = new HostService(new ConfigHostRepository())
  const localEngine: LocalEngineService = new LocalEngineService(new DiscoveryHttpRepository(), new LocalEngineVsCodeRepository(), hosts)
  const connection: ConnectionService = new ConnectionService(hosts, new AuthenticationTokenRepository(AUTH_PROVIDER_ID), new WarpEngineHttpGateway())
  const platforms: PlatformService = new PlatformService(hosts, connection, new MementoPlatformCacheRepository(context.globalState))
  const projects: ProjectService = new ProjectService(infrastructure.files, platforms, new ProcessShellRepository())
  const remote: Pick<Services, 'remoteState' | 'play' | 'signIn' | 'catalog' | 'pipelines' | 'preview'> = remoteServices(context, infrastructure, connection)
  const sync: SyncService = new SyncService({ gateway: new WarpEngineHttpGateway(), discovery: new DiscoveryHttpRepository(), hosts, local: localEngine, signIn: remote.signIn })
  return {
    hosts, localEngine, connection, platforms, projects, ...projectServices(infrastructure, connection, projects), ...remote,
    images: new ImageService(connection), sync
  }
}

function projectServices(infrastructure: Infrastructure, connection: ConnectionService, projects: ProjectService): Pick<Services, 'scaffold' | 'connect' | 'release' | 'publishCheck' | 'make'> {
  const { files, git } = infrastructure
  return {
    scaffold: new ScaffoldService(new TarTemplateRepository(), files, git),
    connect: new ConnectService(connection, git, files),
    release: new ReleaseService(git, files, connection, projects),
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
