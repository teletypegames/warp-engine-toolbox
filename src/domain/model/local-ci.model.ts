/**
 * The local engine's CI: its components, its background operations and the push set-up of a project.
 *
 * @module
 */
/** The state of one component (git server, CI server, …) of the local engine's CI. */
export type ComponentState = 'off' | 'starting' | 'ready' | 'stopped' | 'failed' | 'unavailable'
/** The state of a background operation the local engine runs. */
export type OperationState = 'queued' | 'running' | 'succeeded' | 'failed'

/** A component of the local engine's CI, as the local engine reports it. */
export interface LocalComponent {
  /** The component's key. */
  readonly key: string
  /** The name shown for it. */
  readonly label: string
  /** What it does for the engine (e.g. git server, CI). */
  readonly role: string
  /** The keys of the components it needs running. */
  readonly requires: readonly string[]
  /** A longer description of the component. */
  readonly description: string
  /** Its current state. */
  readonly state: ComponentState
  /** A status or error message, or `null`. */
  readonly message: string | null
}

/** One progress line of a {@link LocalOperation}. */
export interface OperationStep {
  /** When the step happened (ISO 8601). */
  readonly at: string
  /** What happened, in plain words. */
  readonly text: string
}

/** A background operation on the local engine (e.g. setting up the CI of a software), polled until finished. */
export interface LocalOperation {
  /** The operation's id, used to poll it. */
  readonly id: number
  /** What kind of operation it is. */
  readonly kind: string
  /** What it works on. */
  readonly target: string
  /** Its current state. */
  readonly state: OperationState
  /** The progress lines so far, oldest first. */
  readonly steps: readonly OperationStep[]
  /** The result fields once it succeeded, or `null`. */
  readonly result: Readonly<Record<string, unknown>> | null
  /** The error once it failed, or `null`. */
  readonly error: string | null
}

/** Where to push a project so the local CI builds it, read from a finished set-up operation. */
export interface LocalCiSetup {
  /** The git address to push to, credentials included. */
  readonly pushUrl: string
  /** The git remote name to add it under. */
  readonly remoteName: string
  /** The repository's web page on the local git server, or `null`. */
  readonly repoUrl: string | null
  /** Non-fatal problems the local engine reports. */
  readonly warnings: readonly string[]
}

/** Rules on the local engine's CI data. */
export class LocalCi {
  /** The git remote name used for the local CI when the engine names none. */
  public static readonly REMOTE: string = 'wplocal'

  /**
   * Whether an operation has ended, successfully or not.
   *
   * @param operation - The operation as last polled.
   * @returns `true` once it succeeded or failed.
   */
  public static finished(operation: LocalOperation): boolean {
    return operation.state === 'succeeded' || operation.state === 'failed'
  }

  /**
   * The push set-up carried in a finished operation's result.
   *
   * @param operation - The finished set-up operation.
   * @returns The set-up, or `null` when the result has no `pushUrl`.
   */
  public static setupOf(operation: LocalOperation): LocalCiSetup | null {
    const result: Readonly<Record<string, unknown>> = operation.result ?? {}
    const pushUrl: string | null = LocalCi.text(result['pushUrl'])
    if (!pushUrl) return null
    return {
      pushUrl, remoteName: LocalCi.text(result['remoteName']) ?? LocalCi.REMOTE, repoUrl: LocalCi.text(result['repoUrl']),
      warnings: LocalCi.texts(result['warnings'])
    }
  }

  /**
   * Whether the local CI can be used: there are components and every one is ready.
   *
   * @param components - The components the local engine reports.
   * @returns `true` when all are `ready`; `false` for an empty list.
   */
  public static ready(components: readonly LocalComponent[]): boolean {
    return components.length > 0 && components.every((component: LocalComponent) => component.state === 'ready')
  }

  private static text(value: unknown): string | null {
    return typeof value === 'string' && value ? value : null
  }

  private static texts(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item: unknown): item is string => typeof item === 'string') : []
  }
}
