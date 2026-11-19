/**
 * The repositories of the current host with the current token.
 *
 * @module
 */
import type { AdminRepositories, WarpEngineGateway } from '../repository/warp-engine.gateway'
import type { BuildRepository } from '../repository/build.repository'
import type { SignInRepository } from '../repository/sign-in.repository'
import type { TokenRepository } from '../repository/token.repository'
import type { HostService } from './host.service'

/** Hands out the host repositories for the current host and the signed-in session; the one place that pairs a host URL with a token. */
export class ConnectionService {
  /**
   * Creates the service.
   *
   * @param hosts - Gives the current host.
   * @param tokens - Gives the token of the session.
   * @param gateway - Creates the repositories.
   */
  public constructor(
    private readonly hosts: HostService,
    private readonly tokens: TokenRepository,
    private readonly gateway: WarpEngineGateway
  ) {}

  /**
   * Tells whether a host is set.
   *
   * @returns `true` when a current host exists.
   */
  public hasHost(): boolean {
    return this.hosts.current() !== null
  }

  /**
   * Gives the build API of the current host.
   *
   * @param token - The token to send, or `null` (the default) to send none.
   * @returns The build repository.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public build(token: string | null = null): BuildRepository {
    return this.gateway.build(this.hosts.require().url, token)
  }

  /**
   * Gives the build API of the current host with the session's token when there is one, without asking the user.
   *
   * @returns The build repository.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public async signedBuild(): Promise<BuildRepository> {
    return this.build(await this.token(false))
  }

  /**
   * Gives the admin API of the current host.
   *
   * @param createIfNone - `true` starts the sign-in flow when there is no session.
   * @returns The repositories, or `null` when there is no token.
   * @throws {@link "domain/model/message.model".DomainError} When a token exists but no host is set.
   */
  public async admin(createIfNone: boolean): Promise<AdminRepositories | null> {
    const token: string | null = await this.token(createIfNone)
    return token ? this.gateway.admin(this.hosts.require().url, token) : null
  }

  /**
   * Gives the sign-in API of a host.
   *
   * @param hostUrl - The host URL, not necessarily the current one.
   * @returns The sign-in repository.
   */
  public signIn(hostUrl: string): SignInRepository {
    return this.gateway.signIn(hostUrl)
  }

  /**
   * Gets the token of the session.
   *
   * @param createIfNone - `true` starts the sign-in flow when there is no session.
   * @returns The token, or `null` when there is none; always `null` without a host unless `createIfNone`.
   */
  public async token(createIfNone: boolean): Promise<string | null> {
    if (!this.hosts.current() && !createIfNone) return null
    return this.tokens.token(createIfNone)
  }
}
