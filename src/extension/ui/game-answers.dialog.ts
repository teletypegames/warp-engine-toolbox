/**
 * The questions New Game asks.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Category } from '../../domain/model/catalog.model'
import { FIRST_VERSION, GameName, LICENSES, type GameAnswers } from '../../domain/model/game-answers.model'
import type { Platform } from '../../domain/model/platform.model'
import type { CatalogService } from '../../domain/service/catalog.service'
import type { PlatformService } from '../../domain/service/platform.service'
import type { ScaffoldService } from '../../domain/service/scaffold.service'
import { PlatformFormatter } from '../view/platform/platform.formatter'
import { Dialogs, type PickItem } from './dialogs'
import { t } from './l10n'

interface Texts {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly author: string
}

const STATUS_MS = 4000

/** Asks for the platform and the details of a new game; every question can be dismissed, which ends the flow. */
export class GameAnswersDialog {
  /**
   * Creates the dialog.
   *
   * @param platforms - Lists the host's platforms.
   * @param catalog - Lists the host's categories.
   * @param scaffold - Suggests the author.
   */
  public constructor(private readonly platforms: PlatformService, private readonly catalog: CatalogService, private readonly scaffold: ScaffoldService) {}

  /**
   * Asks for a platform from a quick pick of the host's platforms (reloaded), and shows the
   * chosen one's first description line in the status bar for a few seconds.
   *
   * @param title - The quick pick's title.
   * @returns The platform, or `null` when the pick is dismissed.
   */
  public async platform(title: string): Promise<Platform | null> {
    const all: Platform[] = await this.platforms.all(true)
    const items: PickItem<Platform>[] = all.map((platform: Platform) => ({ label: platform.label, description: platform.name, detail: PlatformFormatter.summary(platform), value: platform }))
    const picked: Platform | undefined = await Dialogs.pick(items, { title, matchOnDetail: true, ignoreFocusOut: true })
    if (picked) void vscode.window.setStatusBarMessage(PlatformFormatter.describe(picked).split('\n')[0] ?? '', STATUS_MS)
    return picked ?? null
  }

  /**
   * Asks, in turn, for the name (validated), title, one-line description, author, licence and
   * category of a new game.
   *
   * @param platform - The chosen platform, named in the first question.
   * @param suggestedName - A name to start from, such as the folder's, or `null`.
   * @returns The answers with the first version, the title standing in for an empty
   *   description; `null` when a question is dismissed.
   */
  public async answers(platform: Platform, suggestedName: string | null): Promise<GameAnswers | null> {
    const texts: Texts | null = await this.texts(platform, suggestedName)
    if (!texts) return null
    const license: string | undefined = await vscode.window.showQuickPick([...LICENSES], { title: t('Licence'), ignoreFocusOut: true })
    if (!license) return null
    const category: string | null | undefined = await this.category()
    if (category === undefined) return null
    return { ...texts, license, category, description: texts.description || texts.title, version: FIRST_VERSION }
  }

  private async texts(platform: Platform, suggestedName: string | null): Promise<Texts | null> {
    const name: string | undefined = await this.name(platform, suggestedName)
    if (!name) return null
    const title: string | undefined = await Dialogs.input({ title: t('Title'), value: GameName.titleize(name), ignoreFocusOut: true, validateInput: (value: string) => value.trim() ? null : t('A title') })
    if (!title) return null
    const description: string | undefined = await Dialogs.input({ title: t('One-line description'), placeHolder: t('What the catalog says of it'), ignoreFocusOut: true })
    if (description === undefined) return null
    const author: string | undefined = await Dialogs.input({ title: t('Author'), value: await this.scaffold.author(), ignoreFocusOut: true })
    if (author === undefined) return null
    return { name, title: title.trim(), description: description.trim(), author: author.trim() }
  }

  private async name(platform: Platform, suggestedName: string | null): Promise<string | undefined> {
    return Dialogs.input({
      title: t('New {0} game: name', platform.label), prompt: t('The software and repository name: lower-case letters, digits and dashes'),
      value: GameName.suggest(suggestedName), ignoreFocusOut: true,
      validateInput: (value: string) => GameName.isValid(value) ? null : t('Lower-case letters, digits and dashes, starting with a letter or digit')
    })
  }

  private async category(): Promise<string | null | undefined> {
    const categories: Category[] = await this.catalog.categories()
    const items: PickItem<string | null>[] = [
      { label: t('No category'), value: null },
      ...categories.map((item: Category) => ({ label: item.label, description: item.key, value: item.key }))
    ]
    return Dialogs.pick(items, { title: t('Category'), ignoreFocusOut: true })
  }
}
