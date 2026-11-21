/**
 * The {@link domain/repository/warp-engine.gateway!WarpEngineGateway} port implemented with the HTTP repositories.
 *
 * @module
 */
import type { BuildRepository } from '../../domain/repository/build.repository'
import type { PublicCatalogRepository } from '../../domain/repository/public-catalog.repository'
import type { SignInRepository } from '../../domain/repository/sign-in.repository'
import type { AdminRepositories, WarpEngineGateway } from '../../domain/repository/warp-engine.gateway'
import { HttpBuildRepository } from './build.http-repository'
import { HttpCatalogRepository } from './catalog.http-repository'
import { HttpImageRepository } from './image.http-repository'
import { HttpLocalComponentRepository } from './local-component.http-repository'
import { HttpPipelineRepository } from './pipeline.http-repository'
import { HttpPublicCatalogRepository } from './public-catalog.http-repository'
import { HttpSignInRepository } from './sign-in.http-repository'
import { HttpSyncPairingRepository, HttpSyncPeerRepository } from './sync.http-repository'
import { WarpEngineHttpClient } from './warp-engine.http-client'

/**
 * Hands out the HTTP repositories for a host and token, each on a fresh
 * {@link infrastructure/http/warp-engine.http-client!WarpEngineHttpClient}.
 */
export class WarpEngineHttpGateway implements WarpEngineGateway {
  /**
   * Opens the build API of a host.
   *
   * @param hostUrl - The host URL.
   * @param token - The API token, or `null` for the anonymous endpoints.
   * @returns An {@link infrastructure/http/build.http-repository!HttpBuildRepository}.
   */
  public build(hostUrl: string, token: string | null): BuildRepository {
    return new HttpBuildRepository(new WarpEngineHttpClient(hostUrl, token))
  }

  /**
   * Opens the public catalog (WECP) of a host.
   *
   * @param hostUrl - The host URL.
   * @param token - The API token, or `null` to read anonymously.
   * @returns An {@link infrastructure/http/public-catalog.http-repository!HttpPublicCatalogRepository}.
   */
  public publicCatalog(hostUrl: string, token: string | null): PublicCatalogRepository {
    return new HttpPublicCatalogRepository(new WarpEngineHttpClient(hostUrl, token))
  }

  /**
   * Opens the admin API of a host: catalog, pipelines, images, sync peers and pairings,
   * local components, all sharing one client.
   *
   * @param hostUrl - The host URL.
   * @param token - The API token of an administrator.
   * @returns The admin repositories.
   */
  public admin(hostUrl: string, token: string): AdminRepositories {
    const client: WarpEngineHttpClient = new WarpEngineHttpClient(hostUrl, token)
    return {
      catalog: new HttpCatalogRepository(client), pipelines: new HttpPipelineRepository(client), images: new HttpImageRepository(client),
      syncPeers: new HttpSyncPeerRepository(client), syncPairings: new HttpSyncPairingRepository(client),
      local: new HttpLocalComponentRepository(client)
    }
  }

  /**
   * Opens the sign-in (device grant) API of a host, without a token.
   *
   * @param hostUrl - The host URL.
   * @returns An {@link infrastructure/http/sign-in.http-repository!HttpSignInRepository}.
   */
  public signIn(hostUrl: string): SignInRepository {
    return new HttpSignInRepository(new WarpEngineHttpClient(hostUrl))
  }
}
