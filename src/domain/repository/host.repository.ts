import type { Host } from '../model/host.model'

export interface HostRepository {
  configuredUrl(): string
  configuredHosts(): Host[]
  saveUrl(url: string): Promise<void>
  saveHosts(hosts: readonly Host[]): Promise<void>
}
