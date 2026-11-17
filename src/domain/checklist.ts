import type { KindDescription, PlatformDescription, ReleaseAsset } from './types'

export type ChecklistState = 'present' | 'missing' | 'manual' | 'optional'

export interface ChecklistEntry {
  readonly kind: string
  readonly state: ChecklistState
  readonly note: string
}

export function checklist(platform: PlatformDescription, assets: readonly ReleaseAsset[]): ChecklistEntry[] {
  const present = new Set<string>(assets.map((asset: ReleaseAsset) => asset.kind))
  return platform.kinds.map((kind: KindDescription): ChecklistEntry => {
    if (present.has(kind.name)) return { kind: kind.name, state: 'present', note: kind.required ? 'required' : '' }
    if (kind.optional) return { kind: kind.name, state: 'optional', note: 'optional' }
    if (!kind.built) return { kind: kind.name, state: 'manual', note: 'not built by the pipeline: upload it by hand' }
    return { kind: kind.name, state: 'missing', note: kind.required ? 'required: a publish fails without it' : 'the pipeline builds it' }
  })
}

export function checklistMark(state: ChecklistState): string {
  switch (state) {
    case 'present': return '[x]'
    case 'missing': return '[ ]'
    case 'manual': return '[-]'
    case 'optional': return '[~]'
  }
}
