import type { BuildRepository } from '../../domain/repository/build.repository'
import type { SignInRepository } from '../../domain/repository/sign-in.repository'
import type { AdminRepositories, WarpEngineGateway } from '../../domain/repository/warp-engine.gateway'
import { HttpBuildRepository } from './build.http-repository'
import { HttpCatalogRepository } from './catalog.http-repository'
import { HttpImageRepository } from './image.http-repository'
import { HttpLocalComponentRepository } from './local-component.http-repository'
import { HttpPipelineRepository } from './pipeline.http-repository'
import { HttpSignInRepository } from './sign-in.http-repository'
import { HttpSyncPairingRepository, HttpSyncPeerRepository } from './sync.http-repository'
import { WarpEngineHttpClient } from './warp-engine.http-client'

export class WarpEngineHttpGateway implements WarpEngineGateway {
  public build(hostUrl: string, token: string | null): BuildRepository {
    return new HttpBuildRepository(new WarpEngineHttpClient(hostUrl, token))
  }

  public admin(hostUrl: string, token: string): AdminRepositories {
    const client: WarpEngineHttpClient = new WarpEngineHttpClient(hostUrl, token)
    return {
      catalog: new HttpCatalogRepository(client), pipelines: new HttpPipelineRepository(client), images: new HttpImageRepository(client),
      syncPeers: new HttpSyncPeerRepository(client), syncPairings: new HttpSyncPairingRepository(client),
      local: new HttpLocalComponentRepository(client)
    }
  }

  public signIn(hostUrl: string): SignInRepository {
    return new HttpSignInRepository(new WarpEngineHttpClient(hostUrl))
  }
}
