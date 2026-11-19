import { DEFAULT_STATUSES, type Category, type ExternalLink, type Principal, type Release, type Software, type SoftwareField } from '../model/catalog.model'
import { DomainError, msg } from '../model/message.model'
import type { Pipeline } from '../model/pipeline.model'
import type { AdminRepositories } from '../repository/warp-engine.gateway'
import type { ConnectionService } from './connection.service'

export interface CatalogOverview {
  readonly principal: Principal | null
  readonly softwares: readonly Software[]
  readonly byPlatform: ReadonlyMap<string, readonly Software[]>
}

export class CatalogService {
  public constructor(private readonly connection: ConnectionService) {}

  public async isSignedIn(): Promise<boolean> {
    return (await this.connection.admin(false)) !== null
  }

  public async signIn(): Promise<boolean> {
    return (await this.connection.admin(true)) !== null
  }

  public async overview(): Promise<CatalogOverview | null> {
    const admin: AdminRepositories | null = await this.connection.admin(false)
    if (!admin) return null
    const principal: Principal | null = await admin.catalog.me().catch(() => null)
    const softwares: Software[] = await admin.catalog.softwares()
    return { principal, softwares, byPlatform: CatalogService.group(softwares) }
  }

  public async releases(software: Software): Promise<Release[]> {
    return (await this.require(false)).catalog.releases(software.id)
  }

  public async links(software: Software): Promise<ExternalLink[]> {
    return (await this.require(false)).catalog.externalLinks(software.id)
  }

  public async pipelines(): Promise<Pipeline[]> {
    return (await this.require(false)).pipelines.pipelines()
  }

  public async categories(): Promise<Category[]> {
    return this.connection.build().categories().catch((): Category[] => [])
  }

  public async statuses(): Promise<string[]> {
    const admin: AdminRepositories = await this.require(true)
    const answer: unknown = await admin.catalog.statuses().catch(() => [])
    if (!Array.isArray(answer)) return [...DEFAULT_STATUSES]
    return answer.map((item: { key?: string }) => item.key ?? '').filter(Boolean)
  }

  public async update(software: Software, field: SoftwareField, value: unknown): Promise<void> {
    await (await this.require(true)).catalog.updateSoftware(software.id, { [field]: value })
  }

  public async deleteSoftware(software: Software): Promise<void> {
    await (await this.require(true)).catalog.deleteSoftware(software.id)
  }

  public async deleteRelease(release: Release): Promise<void> {
    await (await this.require(true)).catalog.deleteRelease(release.id)
  }

  public async downloadStats(software: Software): Promise<unknown> {
    return (await this.require(true)).catalog.downloadStats(software.id)
  }

  public async require(createIfNone: boolean): Promise<AdminRepositories> {
    const admin: AdminRepositories | null = await this.connection.admin(createIfNone)
    if (!admin) throw new DomainError(msg('Sign in first.'))
    return admin
  }

  private static group(softwares: readonly Software[]): Map<string, Software[]> {
    const byPlatform: Map<string, Software[]> = new Map<string, Software[]>()
    for (const software of softwares) byPlatform.set(software.platform, [...(byPlatform.get(software.platform) ?? []), software])
    return byPlatform
  }
}
