/**
 * A WarpEngine Local on this machine and the well-known document an engine serves about itself.
 *
 * @module
 */
import type { Host } from './host.model'

/** How an engine runs: a public `server`, or a `local` one on the developer's machine. */
export type EngineProfile = 'server' | 'local'

/** Who may pair another engine with this one for sync: only an admin, or anyone signed in. */
export type PairingPolicy = 'admin' | 'anyone'

/** The sync settings an engine announces in its well-known document. */
export interface EngineSync {
  /** Whether the engine accepts releases pushed to it by a paired engine. */
  readonly inbound: boolean
  /** The engine it pushes its releases to, or `null` when none. */
  readonly target: string | null
  /** Who may pair with it, when the engine says. */
  readonly pairing?: PairingPolicy | null
  /** The sync features it supports, when the engine says. */
  readonly features?: readonly string[]
}

/** The well-known discovery document a WarpEngine serves about itself. */
export interface WellKnown {
  /** Always `warp-engine` for a WarpEngine. */
  readonly engine: string
  /** The engine's version. */
  readonly version: string
  /** The catalog API version it speaks. */
  readonly api: number
  /** The engine's name. */
  readonly name: string
  /** How it runs. */
  readonly profile: EngineProfile
  /** The sign-in methods it offers. */
  readonly signIn: readonly string[]
  /** The base address of its admin API, or `null` when it has none. */
  readonly adminApi: string | null
  /** Whether the admin API is enabled. */
  readonly admin: boolean
  /** Its sync settings. */
  readonly sync: EngineSync
}

/** A WarpEngine Local found running on this machine, with what it announced about itself. */
export class LocalEngine {
  /** The port WarpEngine Local listens on by default. */
  public static readonly DEFAULT_PORT: number = 7470
  /** The address of the WarpEngine Local installer for macOS and Linux. */
  public static readonly INSTALL_SH: string = 'https://git.teletypegames.org/engines/warp-engine-local/raw/branch/master/install.sh'
  /** The address of the WarpEngine Local installer for Windows (PowerShell). */
  public static readonly INSTALL_PS1: string = 'https://git.teletypegames.org/engines/warp-engine-local/raw/branch/master/install.ps1'

  /**
   * Creates the local engine.
   *
   * @param url - The address it was found at.
   * @param info - The well-known document it served.
   */
  public constructor(public readonly url: string, public readonly info: WellKnown) {}

  /**
   * The loopback address of a local engine on a port.
   *
   * @param port - The port.
   * @returns `http://127.0.0.1:<port>`.
   */
  public static urlFor(port: number): string {
    return `http://127.0.0.1:${String(port)}`
  }

  /**
   * Tells whether a host address is on this machine's loopback (`127.0.0.1`, `localhost`, `[::1]`): a local engine's.
   *
   * @param url - The host address.
   * @returns `true` for a loopback address; `false` for any other or an invalid one.
   */
  public static isLoopback(url: string): boolean {
    try {
      return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)
    } catch {
      return false
    }
  }

  /**
   * Whether a parsed JSON body is a WarpEngine's well-known document
   * (`engine` is `warp-engine`, `version` and `profile` are strings).
   *
   * @param value - The parsed body.
   * @returns `true` when it is one.
   */
  public static isWellKnown(value: unknown): value is WellKnown {
    if (typeof value !== 'object' || value === null) return false
    const record: Record<string, unknown> = value as Record<string, unknown>
    return record['engine'] === 'warp-engine' && typeof record['version'] === 'string' && typeof record['profile'] === 'string'
  }

  /** The engine as a {@link Host}, named `Local (<version>)`. */
  public get host(): Host {
    return { name: `Local (${this.info.version})`, url: this.url }
  }

  /** The engine it syncs its releases to, or `null` when none. */
  public get syncTarget(): string | null {
    return this.info.sync.target
  }
}
