import type { BuildRepository } from './build.repository'
import type { CatalogRepository } from './catalog.repository'
import type { ImageRepository } from './image.repository'
import type { PipelineRepository } from './pipeline.repository'
import type { SignInRepository } from './sign-in.repository'
import type { SyncPairingRepository, SyncPeerRepository } from './sync.repository'

export interface AdminRepositories {
  readonly catalog: CatalogRepository
  readonly pipelines: PipelineRepository
  readonly images: ImageRepository
  readonly syncPeers: SyncPeerRepository
  readonly syncPairings: SyncPairingRepository
}

export interface WarpEngineGateway {
  build(hostUrl: string, token: string | null): BuildRepository
  admin(hostUrl: string, token: string): AdminRepositories
  signIn(hostUrl: string): SignInRepository
}
