/**
 * The questions Fork… asks: the original's owner and licence, the target host, the new name and title, and a licence when the original has none.
 *
 * @module
 */
import { ForkNames } from '../../domain/model/fork-name.model'
import type { PublicSoftware } from '../../domain/model/fork.model'
import { HostUrl } from '../../domain/model/host.model'
import type { ForkService, ForkTarget } from '../../domain/service/fork.service'
import { Dialogs, type PickItem } from './dialogs'
import { t } from './l10n'

/** What the user answered for a fork. */
export interface ForkAnswers {
  /** The host the fork is connected to. */
  readonly target: ForkTarget
  /** The fork's technical name. */
  readonly name: string
  /** The fork's title. */
  readonly title: string
}

const LICENSES: readonly string[] = ['MIT', 'GPL-3.0', 'CC-BY-4.0', 'CC0-1.0']

/** Asks what a fork needs; checks the name on the target host while it is typed. */
export class ForkDialog {
  /**
   * Creates the dialog.
   *
   * @param forks - Lists the targets, suggests the name and checks it.
   */
  public constructor(private readonly forks: ForkService) {}

  /**
   * Shows the original's title, engine, owner and licence in a modal, with a clear warning when it has no licence.
   *
   * @param original - The software to fork.
   * @param engine - The base URL of its engine.
   * @returns `true` when the user goes on with *Fork…*.
   */
  public static async confirm(original: PublicSoftware, engine: string): Promise<boolean> {
    const fork: string = t('Fork…')
    const license: string = original.license
      ? t('Licence: {0}', original.license)
      : t('No licence: the author has not said what others may do with this game. Ask the author before you publish your version.')
    const detail: string = [t('Owner: {0}', original.author ?? '—'), license].join('\n')
    return (await Dialogs.choose(t('Fork {0} from {1}?', original.title, HostUrl.nameOf(engine)), detail, fork)) === fork
  }

  /**
   * Asks for the target host (only when there are several), the fork's name (the free `<name>-<user>` suggested, checked
   * on the target as it is typed) and its title.
   *
   * @param original - The software to fork.
   * @returns The answers, or `null` when cancelled.
   * @throws {@link "domain/model/message.model".DomainError} When no host can take the fork.
   */
  public async ask(original: PublicSoftware): Promise<ForkAnswers | null> {
    const target: ForkTarget | null = await this.target()
    if (!target) return null
    const suggested: string = await this.forks.suggestName(target, original)
    const name: string | undefined = await Dialogs.input({
      title: t('Fork of {0}: name on {1}', original.title, target.host.name), value: suggested, ignoreFocusOut: true,
      validateInput: async (value: string): Promise<string | null> => this.checkName(target, value.trim())
    })
    if (!name) return null
    const title: string | undefined = await Dialogs.input({ title: t('Fork of {0}: title', original.title), value: original.title, ignoreFocusOut: true })
    return title?.trim() ? { target, name: name.trim(), title: title.trim() } : null
  }

  /**
   * Asks for a licence for a fork whose original has none: MIT, GPL-3.0, CC-BY-4.0, CC0-1.0 or none.
   *
   * @returns The licence identifier, or `null` for none or when cancelled.
   */
  public static async license(): Promise<string | null> {
    const items: PickItem<string | null>[] = [...LICENSES.map((license: string) => ({ label: license, value: license })), { label: t('No licence'), value: null }]
    return (await Dialogs.pick(items, { title: t('The original has no licence: choose one for your version'), ignoreFocusOut: true })) ?? null
  }

  private async target(): Promise<ForkTarget | null> {
    const targets: ForkTarget[] = await this.forks.targets()
    if (targets.length === 1) return targets[0] ?? null
    const items: PickItem<ForkTarget>[] = targets.map((target: ForkTarget) => ({ label: target.host.name, description: target.user ?? '', detail: target.host.url, value: target }))
    return (await Dialogs.pick(items, { title: t('Where should the fork live?'), ignoreFocusOut: true })) ?? null
  }

  private async checkName(target: ForkTarget, name: string): Promise<string | null> {
    if (!ForkNames.isValid(name)) return t('Use lower-case letters, digits and dashes.')
    const free: boolean = await this.forks.isFree(target, name).catch(() => true)
    return free ? null : t('{0} is taken on {1}.', name, target.host.name)
  }
}
