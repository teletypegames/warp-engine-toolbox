export type ComponentState = 'off' | 'starting' | 'ready' | 'stopped' | 'failed' | 'unavailable'
export type OperationState = 'queued' | 'running' | 'succeeded' | 'failed'

export interface LocalComponent {
  readonly key: string
  readonly label: string
  readonly role: string
  readonly requires: readonly string[]
  readonly description: string
  readonly state: ComponentState
  readonly message: string | null
}

export interface OperationStep {
  readonly at: string
  readonly text: string
}

export interface LocalOperation {
  readonly id: number
  readonly kind: string
  readonly target: string
  readonly state: OperationState
  readonly steps: readonly OperationStep[]
  readonly result: Readonly<Record<string, unknown>> | null
  readonly error: string | null
}

export interface LocalCredentials {
  readonly url: string
  readonly user: string
  readonly password: string
}

export interface LocalCiSetup {
  readonly pushUrl: string
  readonly remoteName: string
  readonly repoUrl: string | null
  readonly warnings: readonly string[]
}

export class LocalCi {
  public static readonly REMOTE: string = 'warp'

  public static finished(operation: LocalOperation): boolean {
    return operation.state === 'succeeded' || operation.state === 'failed'
  }

  private static readonly ACTIONS: Readonly<Record<ComponentState, readonly ('enable' | 'disable' | 'remove')[]>> = {
    unavailable: [], off: ['enable'], ready: ['disable', 'remove'], starting: ['disable', 'remove'],
    stopped: ['enable', 'remove'], failed: ['enable', 'remove']
  }

  public static setupOf(operation: LocalOperation): LocalCiSetup | null {
    const result: Readonly<Record<string, unknown>> = operation.result ?? {}
    const pushUrl: string | null = LocalCi.text(result['pushUrl'])
    if (!pushUrl) return null
    return {
      pushUrl, remoteName: LocalCi.text(result['remoteName']) ?? LocalCi.REMOTE, repoUrl: LocalCi.text(result['repoUrl']),
      warnings: LocalCi.texts(result['warnings'])
    }
  }

  public static actions(component: LocalComponent): readonly ('enable' | 'disable' | 'remove')[] {
    return LocalCi.ACTIONS[component.state]
  }

  private static text(value: unknown): string | null {
    return typeof value === 'string' && value ? value : null
  }

  private static texts(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item: unknown): item is string => typeof item === 'string') : []
  }
}
