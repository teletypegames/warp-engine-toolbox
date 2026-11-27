/**
 * The local engine's CI: its providers, its background tasks and the push set-up of a project.
 *
 * @module
 */
/** The state of one provider (git server, CI server, …) of the local engine's CI. */
export type ProviderState = 'off' | 'starting' | 'ready' | 'stopped' | 'failed' | 'unavailable'
/** The state of a background task the local engine runs. */
export type TaskState = 'queued' | 'running' | 'succeeded' | 'failed'

/** A provider of the local engine's CI, as the local engine reports it. */
export interface LocalProvider {
  /** The provider's key. */
  readonly key: string
  /** The name shown for it. */
  readonly label: string
  /** What it does for the engine (e.g. git server, CI). */
  readonly role: string
  /** The keys of the providers it needs running. */
  readonly requires: readonly string[]
  /** A longer description of the provider. */
  readonly description: string
  /** Its current state. */
  readonly state: ProviderState
  /** A status or error message, or `null`. */
  readonly message: string | null
}

/** One progress line of a {@link LocalTask}. */
export interface TaskStep {
  /** When the step happened (ISO 8601). */
  readonly at: string
  /** What happened, in plain words. */
  readonly text: string
}

/** A background task on the local engine (e.g. setting up the CI of a software), polled until finished. */
export interface LocalTask {
  /** The task's id, used to poll it. */
  readonly id: number
  /** What kind of task it is. */
  readonly kind: string
  /** What it works on. */
  readonly target: string
  /** Its current state. */
  readonly state: TaskState
  /** The progress lines so far, oldest first. */
  readonly steps: readonly TaskStep[]
  /** The result fields once it succeeded, or `null`. */
  readonly result: Readonly<Record<string, unknown>> | null
  /** The error once it failed, or `null`. */
  readonly error: string | null
}

/** Where to push a project so the local CI builds it, read from a finished set-up task. */
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
   * Whether a task has ended, successfully or not.
   *
   * @param task - The task as last polled.
   * @returns `true` once it succeeded or failed.
   */
  public static finished(task: LocalTask): boolean {
    return task.state === 'succeeded' || task.state === 'failed'
  }

  /**
   * The push set-up carried in a finished task's result.
   *
   * @param task - The finished set-up task.
   * @returns The set-up, or `null` when the result has no `pushUrl`.
   */
  public static setupOf(task: LocalTask): LocalCiSetup | null {
    const result: Readonly<Record<string, unknown>> = task.result ?? {}
    const pushUrl: string | null = LocalCi.text(result['pushUrl'])
    if (!pushUrl) return null
    return {
      pushUrl, remoteName: LocalCi.text(result['remoteName']) ?? LocalCi.REMOTE, repoUrl: LocalCi.text(result['repoUrl']),
      warnings: LocalCi.texts(result['warnings'])
    }
  }

  /**
   * Whether the local CI can be used: there are providers and every one is ready.
   *
   * @param providers - The providers the local engine reports.
   * @returns `true` when all are `ready`; `false` for an empty list.
   */
  public static ready(providers: readonly LocalProvider[]): boolean {
    return providers.length > 0 && providers.every((provider: LocalProvider) => provider.state === 'ready')
  }

  private static text(value: unknown): string | null {
    return typeof value === 'string' && value ? value : null
  }

  private static texts(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item: unknown): item is string => typeof item === 'string') : []
  }
}
