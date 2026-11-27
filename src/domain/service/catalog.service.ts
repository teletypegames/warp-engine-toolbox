/**
 * The catalog of the current host as the Catalog view and its commands use it.
 *
 * @module
 */
import { DEFAULT_STATUSES, type Category, type SoftwareLink, type Principal, type Release, type Software, type SoftwareField } from '../model/catalog.model'
import { DomainError, msg } from '../model/message.model'
import type { CiRepository } from '../model/pipeline.model'
import type { AdminRepositories } from '../repository/warp-engine.gateway'
import type { ConnectionService } from './connection.service'

/** What the Catalog view draws: who is signed in and the softwares, also grouped by platform. */
export interface CatalogOverview {
  /** Who the token belongs to, or `null` when the host would not say. */
  readonly principal: Principal | null
  /** Every software of the catalog. */
  readonly softwares: readonly Software[]
  /** The same softwares keyed by platform id. */
  readonly byPlatform: ReadonlyMap<string, readonly Software[]>
}

/**
 * Reads and edits the software catalog of the current host through its admin API.
 *
 * The members that need a session throw {@link "domain/model/message.model".DomainError} "Sign in first." without one; host
 * errors reach the caller unchanged.
 */
export class CatalogService {
  /**
   * Creates the service.
   *
   * @param connection - Gives the admin repositories of the current host.
   */
  public constructor(private readonly connection: ConnectionService) {}

  /**
   * Tells whether a session exists for the current host, without asking the user.
   *
   * @returns `true` when signed in.
   */
  public async isSignedIn(): Promise<boolean> {
    return (await this.connection.admin(false)) !== null
  }

  /**
   * Signs in to the current host, starting the sign-in flow when there is no session.
   *
   * @returns `true` when a session exists afterwards.
   */
  public async signIn(): Promise<boolean> {
    return (await this.connection.admin(true)) !== null
  }

  /**
   * Fetches the principal and every software of the catalog.
   *
   * @returns The overview, or `null` when not signed in.
   */
  public async overview(): Promise<CatalogOverview | null> {
    const admin: AdminRepositories | null = await this.connection.admin(false)
    if (!admin) return null
    const principal: Principal | null = await admin.catalog.me().catch(() => null)
    const softwares: Software[] = await admin.catalog.softwares()
    return { principal, softwares, byPlatform: CatalogService.group(softwares) }
  }

  /**
   * Lists the releases of a software, newest first.
   *
   * @param software - The software.
   * @returns The releases.
   * @throws {@link "domain/model/message.model".DomainError} When not signed in.
   */
  public async releases(software: Software): Promise<Release[]> {
    return (await this.require(false)).catalog.releases(software.id)
  }

  /**
   * Lists the links of a software.
   *
   * @param software - The software.
   * @returns The links.
   * @throws {@link "domain/model/message.model".DomainError} When not signed in.
   */
  public async links(software: Software): Promise<SoftwareLink[]> {
    return (await this.require(false)).catalog.links(software.id)
  }

  /**
   * Lists the CI repositories of the host.
   *
   * @returns The CI repositories.
   * @throws {@link "domain/model/message.model".DomainError} When not signed in.
   */
  public async ciRepositories(): Promise<CiRepository[]> {
    return (await this.require(false)).pipelines.repositories()
  }

  /**
   * Lists the software categories of the host; needs no session.
   *
   * @returns The categories; empty when the host cannot be asked.
   */
  public async categories(): Promise<Category[]> {
    return this.connection.build().categories().catch((): Category[] => [])
  }

  /**
   * Lists the status keys a software can take, signing in when needed.
   *
   * @returns The keys; the default statuses when the host gives no list.
   * @throws {@link "domain/model/message.model".DomainError} When no session can be had.
   */
  public async statuses(): Promise<string[]> {
    const admin: AdminRepositories = await this.require(true)
    const answer: unknown = await admin.catalog.statuses().catch(() => [])
    if (!Array.isArray(answer)) return [...DEFAULT_STATUSES]
    return answer.map((item: { key?: string }) => item.key ?? '').filter(Boolean)
  }

  /**
   * Changes one field of a software on the host, signing in when needed.
   *
   * @param software - The software.
   * @param field - The field to change.
   * @param value - Its new value.
   * @throws {@link "domain/model/message.model".DomainError} When no session can be had.
   */
  public async update(software: Software, field: SoftwareField, value: unknown): Promise<void> {
    await (await this.require(true)).catalog.updateSoftware(software.id, { [field]: value })
  }

  /**
   * Deletes a software from the catalog, signing in when needed.
   *
   * @param software - The software.
   * @throws {@link "domain/model/message.model".DomainError} When no session can be had.
   */
  public async deleteSoftware(software: Software): Promise<void> {
    await (await this.require(true)).catalog.deleteSoftware(software.id)
  }

  /**
   * Deletes one release, signing in when needed.
   *
   * @param release - The release.
   * @throws {@link "domain/model/message.model".DomainError} When no session can be had.
   */
  public async deleteRelease(release: Release): Promise<void> {
    await (await this.require(true)).catalog.deleteRelease(release.id)
  }

  /**
   * Fetches the download statistics of a software, signing in when needed.
   *
   * @param software - The software.
   * @returns The statistics as the host sends them.
   * @throws {@link "domain/model/message.model".DomainError} When no session can be had.
   */
  public async downloadStats(software: Software): Promise<unknown> {
    return (await this.require(true)).catalog.downloadStats(software.id)
  }

  /**
   * Gives the admin repositories of the current host.
   *
   * @param createIfNone - `true` starts the sign-in flow when there is no session.
   * @returns The repositories.
   * @throws {@link "domain/model/message.model".DomainError} When there is no session.
   */
  public async require(createIfNone: boolean): Promise<AdminRepositories> {
    const admin: AdminRepositories | null = await this.connection.admin(createIfNone)
    if (!admin) throw new DomainError(msg('Sign in first.'), 'signIn')
    return admin
  }

  private static group(softwares: readonly Software[]): Map<string, Software[]> {
    const byPlatform: Map<string, Software[]> = new Map<string, Software[]>()
    for (const software of softwares) byPlatform.set(software.platform, [...(byPlatform.get(software.platform) ?? []), software])
    return byPlatform
  }
}
