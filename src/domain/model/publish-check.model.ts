export type ProblemLevel = 'error' | 'warning'

export interface PublishProblem {
  readonly field: string
  readonly message: string
  readonly level: ProblemLevel
}

export interface PublishCheck {
  readonly ok: boolean
  readonly problems: readonly PublishProblem[]
}

export function publishErrors(check: PublishCheck | null): PublishProblem[] {
  return check?.problems.filter((problem: PublishProblem) => problem.level === 'error') ?? []
}
