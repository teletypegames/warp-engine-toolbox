import type { BuildRepository } from '../../domain/repository/build.repository'
import type { SignInRepository } from '../../domain/repository/sign-in.repository'
import type { AdminRepositories, WarpEngineGateway } from '../../domain/repository/warp-engine.gateway'
import { HttpBuildRepository } from './build.http-repository'
import { HttpCatalogRepository } from './catalog.http-repository'
import { HttpPipelineRepository } from './pipeline.http-repository'
import { HttpSignInRepository } from './sign-in.http-repository'
import { WarpEngineHttpClient } from './warp-engine.http-client'

export class WarpEngineHttpGateway implements WarpEngineGateway {
  public build(hostUrl: string, token: string | null): BuildRepository {
    return new HttpBuildRepository(new WarpEngineHttpClient(hostUrl, token))
  }

  public admin(hostUrl: string, token: string): AdminRepositories {
    const client: WarpEngineHttpClient = new WarpEngineHttpClient(hostUrl, token)
    return { catalog: new HttpCatalogRepository(client), pipelines: new HttpPipelineRepository(client) }
  }

  public signIn(hostUrl: string): SignInRepository {
    return new HttpSignInRepository(new WarpEngineHttpClient(hostUrl))
  }
}
