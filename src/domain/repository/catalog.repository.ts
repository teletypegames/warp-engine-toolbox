import type { ExternalLink, Principal, Release, ScaffoldRequest, ScaffoldResult, Software } from '../model/catalog.model'

export interface CatalogRepository {
  me(): Promise<Principal>
  statuses(): Promise<unknown>
  softwares(): Promise<Software[]>
  softwareByName(name: string): Promise<Software | null>
  updateSoftware(id: number, changes: Partial<Software>): Promise<Software>
  deleteSoftware(id: number): Promise<void>
  deleteRelease(id: number): Promise<void>
  releases(softwareId: number): Promise<Release[]>
  externalLinks(softwareId: number): Promise<ExternalLink[]>
  downloadStats(softwareId: number): Promise<unknown>
  scaffold(request: ScaffoldRequest): Promise<ScaffoldResult>
}
