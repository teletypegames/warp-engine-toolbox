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

export class GameAnswersDialog {
  public constructor(private readonly platforms: PlatformService, private readonly catalog: CatalogService, private readonly scaffold: ScaffoldService) {}

  public async platform(title: string): Promise<Platform | null> {
    const all: Platform[] = await this.platforms.all(true)
    const items: PickItem<Platform>[] = all.map((platform: Platform) => ({ label: platform.label, description: platform.name, detail: PlatformFormatter.summary(platform), value: platform }))
    const picked: Platform | undefined = await Dialogs.pick(items, { title, matchOnDetail: true, ignoreFocusOut: true })
    if (picked) void vscode.window.setStatusBarMessage(PlatformFormatter.describe(picked).split('\n')[0] ?? '', STATUS_MS)
    return picked ?? null
  }

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
