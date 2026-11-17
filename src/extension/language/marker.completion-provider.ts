import * as vscode from 'vscode'
import type { Platform } from '../../domain/model/platform.model'
import type { PlatformService } from '../../domain/service/platform.service'
import { t } from '../ui/l10n'
import { PlatformFormatter } from '../view/platform/platform.formatter'

const KEYS: readonly string[] = ['platform', 'name', 'release', 'build']

export class MarkerCompletionProvider implements vscode.CompletionItemProvider {
  public constructor(private readonly platforms: PlatformService) {}

  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
    const before: string = document.lineAt(position.line).text.slice(0, position.character)
    if (/^platform:\s*\S*$/.test(before)) return this.platformItems()
    if (/^\w*$/.test(before) && position.character === before.length) return MarkerCompletionProvider.keyItems()
    return []
  }

  private async platformItems(): Promise<vscode.CompletionItem[]> {
    return (await this.platforms.all().catch((): Platform[] => [])).map((platform: Platform) => {
      const item: vscode.CompletionItem = new vscode.CompletionItem(platform.name, vscode.CompletionItemKind.EnumMember)
      item.detail = platform.label
      item.documentation = new vscode.MarkdownString(PlatformFormatter.describe(platform))
      return item
    })
  }

  private static keyItems(): vscode.CompletionItem[] {
    const details: Readonly<Record<string, string>> = {
      platform: t('The WarpEngine platform that builds this repository'),
      name: t('The software name when it differs from the repository name'),
      release: t('tag: release only on version tags'),
      build: t('How the platform builds (e.g. make)')
    }
    return KEYS.map((key: string) => {
      const item: vscode.CompletionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property)
      item.insertText = `${key}: `
      item.detail = details[key] ?? ''
      return item
    })
  }
}
