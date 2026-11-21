/**
 * The {@link domain/repository/local-engine.repository!LocalEngineRepository} port implemented with the VS Code settings, the installation's files and docker.
 *
 * @module
 */
import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import type { LocalEngineRepository } from '../../domain/repository/local-engine.repository'
import type { ShellResult } from '../../domain/repository/shell.repository'
import { ProcessRunner } from '../process/process.runner'

const SECTION = 'warpengine'
const CONTAINER = 'warp-engine-local'
const DATA_FOLDER = '.warpengine'

/**
 * Finds the WarpEngine Local installation on this machine: its data folder is the
 * `warpengine.localData` setting, or `~/.warpengine`. The members resolve to `null` instead of rejecting.
 */
export class VsCodeLocalEngineRepository implements LocalEngineRepository {
  /**
   * Finds the local engine's port: the `warpengine.localPort` setting when positive, else
   * the `port` of `config.json` in the data folder.
   *
   * @returns The port, or `null` when neither names one.
   */
  public async port(): Promise<number | null> {
    const configured: number = this.settings().get<number>('localPort') ?? 0
    if (configured > 0) return configured
    const config: string | null = await VsCodeLocalEngineRepository.read(this.path('config.json'))
    if (config === null) return null
    try {
      const port: unknown = (JSON.parse(config) as Record<string, unknown>)['port']
      return typeof port === 'number' && port > 0 ? port : null
    } catch {
      return null
    }
  }

  /**
   * Reads the admin token from the `local-token` file of the data folder.
   *
   * @returns The trimmed token, or `null` when the file is missing or empty.
   */
  public async tokenFile(): Promise<string | null> {
    const token: string = (await VsCodeLocalEngineRepository.read(this.path('local-token')))?.trim() ?? ''
    return token.length > 0 ? token : null
  }

  /**
   * Asks the running `warp-engine-local` container for its admin token
   * (`docker exec warp-engine-local bin/warp-engine token`, with the `warpengine.docker` binary).
   *
   * @returns The token, or `null` when the container is not running or prints none.
   */
  public async tokenFromContainer(): Promise<string | null> {
    const docker: string = this.settings().get<string>('docker') ?? 'docker'
    const result: ShellResult = await ProcessRunner.run(docker, ['exec', CONTAINER, 'bin/warp-engine', 'token'], homedir())
    const token: string = result.code === 0 ? result.stdout.trim() : ''
    return token.length > 0 ? token : null
  }

  /**
   * Finds the data folder (the `warpengine.localData` setting, else `~/.warpengine`) when it exists.
   *
   * @returns The folder, or `null` when it does not exist.
   */
  public async dataFolder(): Promise<string | null> {
    const folder: string = this.path('')
    return access(folder).then(() => folder.replace(/[\\/]+$/, ''), () => null)
  }

  /**
   * Tells whether the installer saved its answers: `config.json` in the data folder.
   *
   * @returns `true` when the file exists.
   */
  public async configured(): Promise<boolean> {
    return access(this.path('config.json')).then(() => true, () => false)
  }

  private path(file: string): string {
    const data: string = this.settings().get<string>('localData')?.trim() ?? ''
    return join(data || join(homedir(), DATA_FOLDER), file)
  }

  private settings(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION)
  }

  private static async read(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8')
    } catch {
      return null
    }
  }
}
