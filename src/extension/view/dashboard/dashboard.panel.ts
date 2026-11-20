/**
 * The Dashboard tab: a summary of everything the WarpEngine sidebar shows, as tables.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import type { Message, Remedy } from '../../../domain/model/message.model'
import { Dialogs } from '../../ui/dialogs'
import { t, translate } from '../../ui/l10n'
import { RemedyDialog } from '../../ui/remedy.dialog'
import type { KnownProjectsStore } from '../../workspace/known-projects.store'
import { WebviewHtml } from '../webview.html'
import type { DashboardCollector } from './dashboard.collector'
import { DashboardRenderer, type DashboardText } from './dashboard.renderer'

const VIEW_TYPE = 'warpengine.dashboard'
const COMMAND_PREFIX = 'warpengine.'
const FIRST_START_KEY = 'warpengine.dashboardShown'

interface PageMessage {
  readonly type?: unknown
  readonly command?: unknown
  readonly url?: unknown
  readonly name?: unknown
}

/**
 * Serves `warpengine.openDashboard`: one editor tab with the project's health, pipeline runs, releases, the catalog
 * summary, the local containers and the sync partners. It redraws when it is shown again and on
 * {@link DashboardPanel.refresh}; its buttons run WarpEngine commands, a catalog entry's *Open* opens the folder its
 * project was opened from before, and its links open in the browser.
 */
export class DashboardPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null
  private readonly renderer: DashboardRenderer = new DashboardRenderer(DashboardPanel.text())
  private drawing: Promise<void> | null = null

  /**
   * Creates the panel; nothing is shown until {@link DashboardPanel.open}.
   *
   * @param collector - Gathers what the page shows.
   * @param known - Opens a catalog entry's project from the folder it was opened in before.
   * @param extensionUri - The extension's folder, whose `media/webview` holds the page's style and script.
   */
  public constructor(private readonly collector: DashboardCollector, private readonly known: KnownProjectsStore, private readonly extensionUri: vscode.Uri) {}

  /** `warpengine.openDashboard`: opens the tab (or brings it to the front) and redraws it. */
  public async open(): Promise<void> {
    if (this.panel) this.panel.reveal()
    else this.panel = this.create()
    await this.draw()
  }

  /**
   * Opens the tab at the first start after the toolbox was installed (remembered in the global state).
   *
   * @param memory - The global state.
   */
  public async openOnFirstStart(memory: vscode.Memento): Promise<void> {
    if (memory.get<boolean>(FIRST_START_KEY)) return
    await memory.update(FIRST_START_KEY, true)
    await this.open()
  }

  /** Redraws the tab when it is open and visible; does nothing otherwise. */
  public async refresh(): Promise<void> {
    if (this.panel?.visible) await this.draw()
  }

  /** Closes the tab. */
  public dispose(): void {
    this.panel?.dispose()
  }

  private create(): vscode.WebviewPanel {
    const media: vscode.Uri = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview')
    const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(VIEW_TYPE, t('WarpEngine Dashboard'), vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [media], retainContextWhenHidden: false })
    panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'warp.svg')
    panel.onDidDispose(() => { this.panel = null })
    panel.onDidChangeViewState(() => { if (panel.visible) void this.draw() })
    panel.webview.onDidReceiveMessage((message: PageMessage) => { void this.handle(message) })
    return panel
  }

  private async draw(): Promise<void> {
    this.drawing ??= this.render().finally(() => { this.drawing = null })
    return this.drawing
  }

  private async render(): Promise<void> {
    const panel: vscode.WebviewPanel | null = this.panel
    if (!panel) return
    const media: vscode.Uri = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview')
    const asset = (name: string): string => panel.webview.asWebviewUri(vscode.Uri.joinPath(media, name)).toString()
    const html: string = this.renderer.render(await this.collector.collect(), {
      cspSource: panel.webview.cspSource, nonce: WebviewHtml.nonce(), style: asset('dashboard.css'), script: asset('dashboard.js')
    })
    if (this.panel === panel) panel.webview.html = html
  }

  private async handle(message: PageMessage): Promise<void> {
    if (message.type === 'openProject' && typeof message.name === 'string') await this.openProject(message.name)
    if (message.type === 'command' && typeof message.command === 'string') await DashboardPanel.run(message.command)
    if (message.type === 'open' && typeof message.url === 'string' && /^https?:\/\//.test(message.url)) await Dialogs.openExternal(message.url)
  }

  private async openProject(name: string): Promise<void> {
    const folder: string | null = await this.known.folderOf(name)
    if (!folder) {
      Dialogs.error(t('The folder of {0} is gone.', name))
      return
    }
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folder), { forceNewWindow: false })
  }

  private static async run(command: string): Promise<void> {
    if (!command.startsWith(COMMAND_PREFIX)) return
    await Promise.resolve(vscode.commands.executeCommand(command)).catch(async (error: unknown) => { await RemedyDialog.report(error) })
  }

  private static text(): DashboardText {
    return {
      t: (text: string, ...args: (string | number)[]): string => t(text, ...args),
      message: (message: Message): string => translate(message),
      remedy: (remedy: Remedy) => ({ label: RemedyDialog.label(remedy), command: RemedyDialog.command(remedy).command }),
      time: (value: string | null): string => DashboardPanel.time(value)
    }
  }

  private static time(value: string | null): string {
    if (!value) return ''
    const date: Date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
  }
}
