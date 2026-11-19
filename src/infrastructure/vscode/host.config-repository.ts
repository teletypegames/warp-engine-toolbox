/**
 * The {@link domain/repository/host.repository!HostRepository} port implemented with the VS Code settings.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { HostRepository } from '../../domain/repository/host.repository'

const SECTION = 'warpengine'

/**
 * Keeps the WarpEngine hosts in the `warpengine.url` and `warpengine.hosts` settings,
 * writing them to the user (global) settings.
 */
export class ConfigHostRepository implements HostRepository {
  /**
   * Reads the `warpengine.url` setting: the current host.
   *
   * @returns The URL, or an empty string when it is not set.
   */
  public configuredUrl(): string {
    return this.settings().get<string>('url') ?? ''
  }

  /**
   * Reads the `warpengine.hosts` setting: the hosts the user can switch between.
   *
   * @returns The hosts; an empty list when it is not set.
   */
  public configuredHosts(): Host[] {
    return this.settings().get<Host[]>('hosts') ?? []
  }

  /**
   * Writes `warpengine.url` to the user settings.
   *
   * @param url - The current host's URL.
   */
  public async saveUrl(url: string): Promise<void> {
    await this.settings().update('url', url, vscode.ConfigurationTarget.Global)
  }

  /**
   * Writes `warpengine.hosts` to the user settings.
   *
   * @param hosts - The full host list.
   */
  public async saveHosts(hosts: readonly Host[]): Promise<void> {
    await this.settings().update('hosts', hosts, vscode.ConfigurationTarget.Global)
  }

  private settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION)
  }
}
