import type { Host } from './host.model'

export type EngineProfile = 'server' | 'local'

export interface EngineSync {
  readonly inbound: boolean
  readonly target: string | null
}

export interface WellKnown {
  readonly engine: string
  readonly version: string
  readonly api: number
  readonly name: string
  readonly profile: EngineProfile
  readonly signIn: readonly string[]
  readonly adminApi: string | null
  readonly admin: boolean
  readonly sync: EngineSync
}

export class LocalEngine {
  public static readonly DEFAULT_PORT: number = 7470
  public static readonly INSTALL_SH: string = 'https://git.teletypegames.org/engines/warp-engine-local/raw/branch/master/install.sh'
  public static readonly INSTALL_PS1: string = 'https://git.teletypegames.org/engines/warp-engine-local/raw/branch/master/install.ps1'

  public constructor(public readonly url: string, public readonly info: WellKnown) {}

  public static urlFor(port: number): string {
    return `http://127.0.0.1:${String(port)}`
  }

  public static isWellKnown(value: unknown): value is WellKnown {
    if (typeof value !== 'object' || value === null) return false
    const record: Record<string, unknown> = value as Record<string, unknown>
    return record['engine'] === 'warp-engine' && typeof record['version'] === 'string' && typeof record['profile'] === 'string'
  }

  public get host(): Host {
    return { name: `Local (${this.info.version})`, url: this.url }
  }

  public get syncTarget(): string | null {
    return this.info.sync.target
  }
}
