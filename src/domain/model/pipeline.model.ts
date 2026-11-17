export interface Pipeline {
  readonly id: number
  readonly repoOwner: string
  readonly repoName: string
  readonly platform: string
  readonly active: boolean
  readonly softwareId: number | null
}

export interface PipelineRun {
  readonly number: number
  readonly status: string
  readonly branch: string | null
  readonly message: string | null
  readonly createdAt: string | null
  readonly url: string | null
  readonly commit: string | null
  readonly event: string | null
  readonly ref: string | null
}

const RUNNING: ReadonlySet<string> = new Set(['pending', 'running', 'created', 'blocked', 'started'])

export function isRunning(run: PipelineRun | null): boolean {
  return run !== null && RUNNING.has(run.status)
}

export function isSuccess(run: PipelineRun): boolean {
  return run.status === 'success'
}
