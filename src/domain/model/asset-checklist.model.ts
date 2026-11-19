/**
 * The asset checklist of a release: which asset kinds of its platform it has.
 *
 * @module
 */
import type { ReleaseAsset } from './catalog.model'
import { msg, type Message } from './message.model'
import type { KindDescription } from './platform-description.model'
import type { Platform } from './platform.model'

/**
 * Where one asset kind of a release stands: uploaded, missing, to be uploaded by
 * hand (the pipeline does not build it), or optional.
 */
export type ChecklistState = 'present' | 'missing' | 'manual' | 'optional'

/** One row of an {@link AssetChecklist}: an asset kind of the platform and its state. */
export interface ChecklistEntry {
  /** The asset kind, as the platform names it (e.g. `html`, `cart`). */
  readonly kind: string
  /** Whether the release has it, and if not, why. */
  readonly state: ChecklistState
  /** A short explanation shown next to the kind, or `null` when there is nothing to add. */
  readonly note: Message | null
}

const MARKS: Readonly<Record<ChecklistState, string>> = { present: '[x]', missing: '[ ]', manual: '[-]', optional: '[~]' }

/**
 * The asset kinds a platform expects, checked against the assets a release
 * actually has; drawn under a release in the tree and in the release report.
 */
export class AssetChecklist {
  /** One entry per asset kind of the platform, in the platform's order. */
  public readonly entries: readonly ChecklistEntry[]

  /**
   * Builds the checklist of a release.
   *
   * @param platform - The platform whose asset kinds are expected.
   * @param assets - The assets the release has on the host.
   */
  public constructor(platform: Platform, assets: readonly ReleaseAsset[]) {
    const present: Set<string> = new Set<string>(assets.map((asset: ReleaseAsset) => asset.kind))
    this.entries = platform.kinds.map((kind: KindDescription) => AssetChecklist.entry(kind, present.has(kind.name)))
  }

  /**
   * The checkbox-like mark of a state: `[x]` present, `[ ]` missing, `[-]` manual, `[~]` optional.
   *
   * @param state - The state to mark.
   * @returns The three-character mark.
   */
  public static mark(state: ChecklistState): string {
    return MARKS[state]
  }

  /** The number of entries whose state is `missing`. */
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
