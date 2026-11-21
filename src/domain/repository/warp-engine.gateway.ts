/**
 * Port that hands out the host repositories for a host URL and token.
 *
 * @module
 */
import type { BuildRepository } from './build.repository'
import type { CatalogRepository } from './catalog.repository'
import type { ImageRepository } from './image.repository'
import type { LocalComponentRepository } from './local-component.repository'
import type { PipelineRepository } from './pipeline.repository'
import type { PublicCatalogRepository } from './public-catalog.repository'
import type { SignInRepository } from './sign-in.repository'
import type { SyncPairingRepository, SyncPeerRepository } from './sync.repository'

/** The admin API repositories of one host, all sharing one token. */
export interface AdminRepositories {
  /** The softwares and releases. */
  readonly catalog: CatalogRepository
  /** The CI pipelines. */
  readonly pipelines: PipelineRepository
  /** The software images. */
  readonly images: ImageRepository
  /** The sync peers. */
  readonly syncPeers: SyncPeerRepository
  /** The sync pairings. */
  readonly syncPairings: SyncPairingRepository
  /** The local components of a local engine. */
  readonly local: LocalComponentRepository
}

/** Creates the repositories that talk to a WarpEngine host; creating one makes no request. */
export interface WarpEngineGateway {
  /**
   * Gives the public build API of a host.
   *
   * @param hostUrl - The host URL.
   * @param token - The admin token to send along, or `null` to send none.
   * @returns The build repository.
   */
  build(hostUrl: string, token: string | null): BuildRepository
  /**
   * Gives the public catalog (WECP) of a host.
   *
   * @param hostUrl - The host URL.
   * @param token - The admin token to send along, or `null` to read anonymously.
   * @returns The public catalog repository.
   */
  publicCatalog(hostUrl: string, token: string | null): PublicCatalogRepository
  /**
   * Gives the admin API repositories of a host.
   *
   * @param hostUrl - The host URL.
   * @param token - The admin token.
   * @returns The repositories.
   */
  admin(hostUrl: string, token: string): AdminRepositories
  /**
   * Gives the sign-in API of a host, used without a token.
   *
   * @param hostUrl - The host URL.
   * @returns The sign-in repository.
   */
  signIn(hostUrl: string): SignInRepository
}
