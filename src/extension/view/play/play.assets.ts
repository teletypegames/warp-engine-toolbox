/**
 * Loading the Play webview assets from the extension folder.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { t } from '../../ui/l10n'
import { PlayPageRenderer, type PlayAssets } from './play-page.renderer'

const FILES: Readonly<Record<keyof PlayAssets, string>> = {
  style: 'play.css', toolbar: 'play-toolbar.js', start: 'play-start.js', relay: 'play-relay.js', handoff: 'play-handoff.js'
}

/** Reads the Play assets from `media/webview` once and builds the {@link PlayPageRenderer} with the translated texts. */
export class PlayRendererLoader {
  private renderer: PlayPageRenderer | null = null

  /**
   * Creates the loader.
   *
   * @param extensionUri - The extension's folder.
   */
  public constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Returns the renderer, reading the asset files on the first call.
   *
   * @returns The renderer, the same on every call.
   */
  public async load(): Promise<PlayPageRenderer> {
    this.renderer ??= new PlayPageRenderer(await this.assets(), {
      replay: t('Build and play again'), external: t('Open in browser'),
      clickToStart: t('Click to start'), soundHint: t('the browser lets the game’s sound start only after a click')
    })
    return this.renderer
  }

  private async assets(): Promise<PlayAssets> {
    const entries: [string, string][] = await Promise.all(Object.entries(FILES).map(async ([key, file]: [string, string]) => [key, await this.read(file)] as [string, string]))
    return Object.fromEntries(entries) as unknown as PlayAssets
  }

  private async read(file: string): Promise<string> {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.extensionUri, 'media', 'webview', file)))
  }
}
