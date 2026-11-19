import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import type { LocalEngineRepository } from '../../domain/repository/local-engine.repository'
import type { ShellResult } from '../../domain/repository/shell.repository'
import { ProcessRunner } from '../process/process.runner'

const SECTION = 'warpengine'
const CONTAINER = 'warp-engine-local'
const DATA_FOLDER = '.warpengine'

export class LocalEngineVsCodeRepository implements LocalEngineRepository {
  public async port(): Promise<number | null> {
    const configured: number = this.settings().get<number>('localPort') ?? 0
    if (configured > 0) return configured
    const config: string | null = await LocalEngineVsCodeRepository.read(this.path('config.json'))
    if (config === null) return null
    try {
      const port: unknown = (JSON.parse(config) as Record<string, unknown>)['port']
      return typeof port === 'number' && port > 0 ? port : null
    } catch {
      return null
    }
  }

  public async tokenFile(): Promise<string | null> {
    const token: string = (await LocalEngineVsCodeRepository.read(this.path('local-token')))?.trim() ?? ''
    return token.length > 0 ? token : null
  }

  public async tokenFromContainer(): Promise<string | null> {
    const docker: string = this.settings().get<string>('docker') ?? 'docker'
    const result: ShellResult = await ProcessRunner.run(docker, ['exec', CONTAINER, 'bin/warp-engine', 'token'], homedir())
    const token: string = result.code === 0 ? result.stdout.trim() : ''
    return token.length > 0 ? token : null
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
