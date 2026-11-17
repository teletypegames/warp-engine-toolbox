import type { AdminRepositories, WarpEngineGateway } from '../repository/warp-engine.gateway'
import type { BuildRepository } from '../repository/build.repository'
import type { SignInRepository } from '../repository/sign-in.repository'
import type { TokenRepository } from '../repository/token.repository'
import type { HostService } from './host.service'

export class ConnectionService {
  public constructor(
    private readonly hosts: HostService,
    private readonly tokens: TokenRepository,
    private readonly gateway: WarpEngineGateway
  ) {}

  public hasHost(): boolean {
    return this.hosts.current() !== null
  }

  public build(token: string | null = null): BuildRepository {
    return this.gateway.build(this.hosts.require().url, token)
  }

  public async signedBuild(): Promise<BuildRepository> {
    return this.build(await this.token(false))
  }

  public async admin(createIfNone: boolean): Promise<AdminRepositories | null> {
    const token: string | null = await this.token(createIfNone)
    return token ? this.gateway.admin(this.hosts.require().url, token) : null
  }

  public signIn(hostUrl: string): SignInRepository {
    return this.gateway.signIn(hostUrl)
  }

  public async token(createIfNone: boolean): Promise<string | null> {
    if (!this.hosts.current() && !createIfNone) return null
    return this.tokens.token(createIfNone)
  }
}
