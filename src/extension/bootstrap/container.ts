import type * as vscode from 'vscode'
import type { PreviewRepository } from '../../domain/repository/preview.repository'
import type { FileSystemRepository } from '../../domain/repository/file-system.repository'
import type { SourceControlFactory } from '../../domain/repository/source-control.repository'
import { CatalogService } from '../../domain/service/catalog.service'
import { ConnectService } from '../../domain/service/connect.service'
import { ConnectionService } from '../../domain/service/connection.service'
import { HostService } from '../../domain/service/host.service'
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
import { GitCliFactory } from '../../infrastructure/git/git.cli-repository'
import { WarpEngineHttpGateway } from '../../infrastructure/http/warp-engine.http-gateway'
import { PreviewServer } from '../../infrastructure/preview/preview.server'
import { ProcessShellRepository } from '../../infrastructure/process/shell.process-repository'
import { TarTemplateRepository } from '../../infrastructure/template/template.tar-repository'
import { VsCodeFileSystemRepository } from '../../infrastructure/vscode/file-system.vscode-repository'
import { ConfigHostRepository } from '../../infrastructure/vscode/host.config-repository'
import { MementoPlatformCacheRepository } from '../../infrastructure/vscode/platform-cache.memento-repository'
import { SecretSessionRepository } from '../../infrastructure/vscode/session.secret-repository'
import { AuthenticationTokenRepository } from '../../infrastructure/vscode/token.authentication-repository'
import { AUTH_PROVIDER_ID } from '../auth/warp-engine.auth-provider'
import type { CatalogController } from '../controller/catalog.controller'
import type { ConnectController } from '../controller/connect.controller'
import type { HostController } from '../controller/host.controller'
import type { LinkController } from '../controller/link.controller'
import type { NewGameController } from '../controller/new-game.controller'
import type { ProjectController } from '../controller/project.controller'
import type { RefreshController } from '../controller/refresh.controller'
import type { ReleaseController } from '../controller/release.controller'
import type { SignInController } from '../controller/sign-in.controller'

export interface Services {
  readonly hosts: HostService
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
}

interface Infrastructure {
  readonly files: FileSystemRepository
  readonly git: SourceControlFactory
}

export function createServices(context: vscode.ExtensionContext): Services {
  const infrastructure: Infrastructure = { files: new VsCodeFileSystemRepository(), git: new GitCliFactory() }
  const hosts: HostService = new HostService(new ConfigHostRepository())
  const connection: ConnectionService = new ConnectionService(hosts, new AuthenticationTokenRepository(AUTH_PROVIDER_ID), new WarpEngineHttpGateway())
  const platforms: PlatformService = new PlatformService(hosts, connection, new MementoPlatformCacheRepository(context.globalState))
  const projects: ProjectService = new ProjectService(infrastructure.files, platforms, new ProcessShellRepository())
  return { hosts, connection, platforms, projects, ...projectServices(infrastructure, connection, projects), ...remoteServices(context, infrastructure, connection) }
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
