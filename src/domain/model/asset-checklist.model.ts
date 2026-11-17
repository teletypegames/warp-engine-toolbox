import type { ReleaseAsset } from './catalog.model'
import { msg, type Message } from './message.model'
import type { KindDescription } from './platform-description.model'
import type { Platform } from './platform.model'

export type ChecklistState = 'present' | 'missing' | 'manual' | 'optional'

export interface ChecklistEntry {
  readonly kind: string
  readonly state: ChecklistState
  readonly note: Message | null
}

const MARKS: Readonly<Record<ChecklistState, string>> = { present: '[x]', missing: '[ ]', manual: '[-]', optional: '[~]' }

export class AssetChecklist {
  public readonly entries: readonly ChecklistEntry[]

  public constructor(platform: Platform, assets: readonly ReleaseAsset[]) {
    const present: Set<string> = new Set<string>(assets.map((asset: ReleaseAsset) => asset.kind))
    this.entries = platform.kinds.map((kind: KindDescription) => AssetChecklist.entry(kind, present.has(kind.name)))
  }

  public static mark(state: ChecklistState): string {
    return MARKS[state]
  }

  public get missing(): number {
    return this.entries.filter((entry: ChecklistEntry) => entry.state === 'missing').length
  }

  private static entry(kind: KindDescription, present: boolean): ChecklistEntry {
    if (present) return { kind: kind.name, state: 'present', note: kind.required ? msg('required') : null }
    if (kind.optional) return { kind: kind.name, state: 'optional', note: msg('optional') }
    if (!kind.built) return { kind: kind.name, state: 'manual', note: msg('not built by the pipeline: upload it by hand') }
    return { kind: kind.name, state: 'missing', note: kind.required ? msg('required: a publish fails without it') : msg('the pipeline builds it') }
  }
}
