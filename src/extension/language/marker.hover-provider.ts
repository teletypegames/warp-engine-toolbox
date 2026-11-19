/**
 * The hover on the marker's `platform:` line.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Platform } from '../../domain/model/platform.model'
import type { PlatformService } from '../../domain/service/platform.service'
import { PlatformFormatter } from '../view/platform/platform.formatter'
import { PLATFORM_LINE } from './marker.selector'

/** Describes the platform when the pointer rests on the `platform:` line of a pipeline file. */
export class MarkerHoverProvider implements vscode.HoverProvider {
  /**
   * Creates the provider.
   *
   * @param platforms - Finds the platform the line names.
   */
  public constructor(private readonly platforms: PlatformService) {}

  /**
   * Provides the platform's description as Markdown for a `platform:` line, from the host's platform list.
   *
   * @param document - The pipeline file.
   * @param position - The pointer position; only its line is used.
   * @returns The hover, or `null` when the line is not a `platform:` line or the platform is unknown or cannot be loaded.
   */
  public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
    const name: string | undefined = PLATFORM_LINE.exec(document.lineAt(position.line).text)?.[1]
    if (!name) return null
    const platform: Platform | null = await this.platforms.find(name).catch(() => null)
    return platform ? new vscode.Hover(new vscode.MarkdownString(PlatformFormatter.describe(platform))) : null
  }
}
