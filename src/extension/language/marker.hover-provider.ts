import * as vscode from 'vscode'
import type { Platform } from '../../domain/model/platform.model'
import type { PlatformService } from '../../domain/service/platform.service'
import { PlatformFormatter } from '../view/platform/platform.formatter'
import { PLATFORM_LINE } from './marker.selector'

export class MarkerHoverProvider implements vscode.HoverProvider {
  public constructor(private readonly platforms: PlatformService) {}

  public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
    const name: string | undefined = PLATFORM_LINE.exec(document.lineAt(position.line).text)?.[1]
    if (!name) return null
    const platform: Platform | null = await this.platforms.find(name).catch(() => null)
    return platform ? new vscode.Hover(new vscode.MarkdownString(PlatformFormatter.describe(platform))) : null
  }
}
