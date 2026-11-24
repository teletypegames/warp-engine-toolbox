/**
 * Completion for the pipeline marker's keys, their values and the platform names.
 *
 * @module
 */
import * as vscode from 'vscode'
import { Marker } from '../../domain/model/marker.model'
import type { MarkerOptionDescription } from '../../domain/model/platform-description.model'
import type { Platform } from '../../domain/model/platform.model'
import type { PlatformService } from '../../domain/service/platform.service'
import { t } from '../ui/l10n'
import { PlatformFormatter } from '../view/platform/platform.formatter'

const FALLBACK_KEYS: readonly string[] = ['release', 'build']

/**
 * Completes the marker keys and, after `platform:`, the host's platforms. The keys besides `platform`
 * and `name`, and the values after them, come from the platform's description (`options`); a host that
 * does not describe them gets the fixed keys `release` and `build`.
 */
export class MarkerCompletionProvider implements vscode.CompletionItemProvider {
  /**
   * Creates the provider.
   *
   * @param platforms - Lists the host's platforms.
   */
  public constructor(private readonly platforms: PlatformService) {}

  /**
   * Provides the platform names, with label and description, after `platform:`; the values of a marker
   * option after `key:`; the marker keys not written yet (inserting `key: `) while a bare word is typed
   * at the start of a line; nothing elsewhere.
   *
   * @param document - The pipeline file.
   * @param position - The cursor position.
   * @returns The items; no platforms or options when they cannot be loaded.
   */
  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
    const before: string = document.lineAt(position.line).text.slice(0, position.character)
    if (/^platform:\s*\S*$/.test(before)) return this.platformItems()
    const marker: Marker = Marker.parse(document.getText())
    const value: RegExpExecArray | null = /^([A-Za-z_][\w-]*):\s*\S*$/.exec(before)
    if (value?.[1]) return MarkerCompletionProvider.valueItems(await this.options(marker), value[1])
    if (/^\w*$/.test(before) && position.character === before.length) return MarkerCompletionProvider.keyItems(await this.options(marker), marker)
    return []
  }

  private async options(marker: Marker): Promise<readonly MarkerOptionDescription[] | null> {
    const platform: Platform | null = await this.platforms.find(marker.platform).catch((): null => null)
    return platform?.markerOptions ?? null
  }

  private async platformItems(): Promise<vscode.CompletionItem[]> {
    return (await this.platforms.all().catch((): Platform[] => [])).map((platform: Platform) => {
      const item: vscode.CompletionItem = new vscode.CompletionItem(platform.name, vscode.CompletionItemKind.EnumMember)
      item.detail = platform.label
      item.documentation = new vscode.MarkdownString(PlatformFormatter.describe(platform))
      return item
    })
  }

  private static valueItems(options: readonly MarkerOptionDescription[] | null, key: string): vscode.CompletionItem[] {
    const option: MarkerOptionDescription | undefined = options?.find((candidate: MarkerOptionDescription) => candidate.name === key)
    return (option?.values ?? []).map((value: string) => {
      const item: vscode.CompletionItem = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember)
      item.detail = option?.description ?? ''
      return item
    })
  }

  private static keyItems(options: readonly MarkerOptionDescription[] | null, marker: Marker): vscode.CompletionItem[] {
    const details: Record<string, string> = {
      platform: t('The WarpEngine platform that builds this repository'),
      name: t('The software name when it differs from the repository name')
    }
    if (options) for (const option of options) details[option.name] = option.description
    else Object.assign(details, { release: t('tag: release only on version tags'), build: t('How the platform builds (e.g. make)') })
    const keys: string[] = ['platform', 'name', ...(options ? options.map((option: MarkerOptionDescription) => option.name) : FALLBACK_KEYS)]
    const written: ReadonlySet<string> = new Set([...(marker.platform ? ['platform'] : []), ...(marker.name ? ['name'] : []), ...Object.keys(marker.options)])
    return keys.filter((key: string) => !written.has(key)).map((key: string) => {
      const item: vscode.CompletionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property)
      item.insertText = `${key}: `
      item.detail = details[key] ?? ''
      return item
    })
  }
}
