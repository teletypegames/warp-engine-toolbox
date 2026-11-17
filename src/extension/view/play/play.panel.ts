import * as vscode from 'vscode'
import { FilePath } from '../../../domain/model/path.model'
import type { Project } from '../../../domain/model/project.model'
import type { PreviewRepository } from '../../../domain/repository/preview.repository'
import type { HostService } from '../../../domain/service/host.service'
import type { MakeService } from '../../../domain/service/make.service'
import type { PlayPlan, PlayService } from '../../../domain/service/play.service'
import type { MakeTaskProvider } from '../../language/make.task-provider'
import { Dialogs } from '../../ui/dialogs'
import { t } from '../../ui/l10n'
import type { ProjectRegistry } from '../../workspace/project.registry'
import type { PlayRendererLoader } from './play.assets'
import type { PlayPageRenderer } from './play-page.renderer'

const BROWSER_PAGE = '/__warpengine/play.html'

export interface PlayDependencies {
  readonly hosts: HostService
  readonly projects: ProjectRegistry
  readonly play: PlayService
  readonly make: MakeService
  readonly tasks: MakeTaskProvider
  readonly preview: PreviewRepository
  readonly renderers: PlayRendererLoader
}

interface Prepared {
  readonly project: Project
  readonly plan: PlayPlan
  readonly payload: string
  readonly base: string
  readonly shown: string
}

export class PlayPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null
  private external = ''
  private handoff: { name: string; bytes: Uint8Array } | null = null
  public lastUrl: string | null = null

  public constructor(private readonly deps: PlayDependencies) {}

  public async play(): Promise<void> {
    const prepared: Prepared | null = await this.prepare()
    if (!prepared) return
    const renderer: PlayPageRenderer = await this.deps.renderers.load()
    const panel: vscode.WebviewPanel = this.ensurePanel(prepared.project)
    if (prepared.plan.binding) await this.showRuntime(prepared, panel, renderer)
    else await this.showLocal(prepared, panel, renderer)
  }

  public dispose(): void {
    this.panel?.dispose()
    void this.deps.preview.close()
  }

  private async prepare(): Promise<Prepared | null> {
    const project: Project = this.deps.projects.require()
    this.deps.hosts.require()
    const plan: PlayPlan = this.deps.play.plan(project, await this.deps.make.targets(project))
    if (plan.target && !(await this.deps.tasks.run(project, plan.target))) {
      Dialogs.error(t('make {0} failed; see the terminal.', plan.target))
      return null
    }
    const payload: string | null = await this.deps.play.findPayload(project, plan.payloadKind)
    if (!payload) {
      Dialogs.error(plan.payloadKind === 'html' ? t('No index.html of a web build was found.') : t('No {0} build was found.', plan.payloadKind))
      return null
    }
    const base: string = await this.deps.preview.serve(FilePath.dirname(payload))
    return { project, plan, payload, base, shown: FilePath.relative(project.folder, payload) }
  }

  private async showLocal(prepared: Prepared, panel: vscode.WebviewPanel, renderer: PlayPageRenderer): Promise<void> {
    this.handoff = null
    this.external = prepared.base
    this.lastUrl = prepared.base
    const html: string = new TextDecoder().decode(await this.deps.play.payload(prepared.payload))
    const folder: string = panel.webview.asWebviewUri(vscode.Uri.file(FilePath.dirname(prepared.payload))).toString()
    panel.webview.html = renderer.local({ html, folder, cspSource: panel.webview.cspSource, shown: prepared.shown })
  }

  private async showRuntime(prepared: Prepared, panel: vscode.WebviewPanel, renderer: PlayPageRenderer): Promise<void> {
    const preview: string = this.deps.play.previewUrl(prepared.project)
    const page: string = await this.deps.play.hostPage(preview)
    const name: string = FilePath.basename(prepared.payload)
    this.deps.preview.proxy('/file/', this.deps.hosts.require().url)
    this.deps.preview.page(BROWSER_PAGE, renderer.browser(page, `/${encodeURIComponent(name)}`, name))
    this.handoff = { name, bytes: await this.deps.play.payload(prepared.payload) }
    this.external = `${prepared.base.replace(/\/$/, '')}${BROWSER_PAGE}`
    this.lastUrl = preview
    panel.webview.html = renderer.runtime(page, prepared.base, prepared.shown)
  }

  private ensurePanel(project: Project): vscode.WebviewPanel {
    this.panel ??= this.createPanel()
    this.panel.title = t('Play {0}', project.name)
    this.panel.reveal(vscode.ViewColumn.Beside, true)
    return this.panel
  }

  private createPanel(): vscode.WebviewPanel {
    const roots: vscode.Uri[] = (vscode.workspace.workspaceFolders ?? []).map((folder: vscode.WorkspaceFolder) => folder.uri)
    const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel('warpengine.play', t('Play'), vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: roots })
    panel.onDidDispose(() => { this.panel = null })
    panel.webview.onDidReceiveMessage((message: { type?: string }) => { this.receive(panel, message) })
    return panel
  }

  private receive(panel: vscode.WebviewPanel, message: { type?: string }): void {
    if (message.type === 'external') void Dialogs.openExternal(this.external)
    if (message.type === 'replay') void this.play()
    if (message.type === 'ready' && this.handoff) void panel.webview.postMessage({ type: 'warpengine.payload', name: this.handoff.name, data: this.handoff.bytes })
  }
}

