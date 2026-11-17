import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { HostRepository } from '../../domain/repository/host.repository'

const SECTION = 'warpengine'

export class ConfigHostRepository implements HostRepository {
  public configuredUrl(): string {
    return this.settings().get<string>('url') ?? ''
  }

  public configuredHosts(): Host[] {
    return this.settings().get<Host[]>('hosts') ?? []
  }

  public async saveUrl(url: string): Promise<void> {
    await this.settings().update('url', url, vscode.ConfigurationTarget.Global)
  }

  public async saveHosts(hosts: readonly Host[]): Promise<void> {
    await this.settings().update('hosts', hosts, vscode.ConfigurationTarget.Global)
  }

  private settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION)
  }
}
