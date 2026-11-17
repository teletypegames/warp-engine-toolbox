import { randomBytes } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, relative } from 'node:path'
import * as vscode from 'vscode'
import type { KindDescription, WebBindingDescription } from '../domain/types'
import { PreviewServer } from '../infrastructure/previewServer'
import type { Hosts } from './hosts'
import type { Project, Projects } from './project'
import { makeTargets, runTarget, type WarpTasks } from './tasks'

const EXCLUDE = '{**/node_modules/**,**/.git/**,**/.godot/**,**/target/**}'
const BROWSER_PAGE = '/__warpengine/play.html'

interface Handoff {
  readonly name: string
  readonly base64: string
}

export class Player implements vscode.Disposable {
  private readonly server: PreviewServer = new PreviewServer()
  private panel: vscode.WebviewPanel | null = null
  public lastUrl: string | null = null

  public constructor(private readonly hosts: Hosts, private readonly projects: Projects, private readonly tasks: WarpTasks) {}

  public async play(): Promise<void> {
    const project: Project = this.projects.require()
    const host: string = this.hosts.require().url
    const binding: WebBindingDescription | null = project.platform?.web.find((candidate: WebBindingDescription) => candidate.default) ?? project.platform?.web[0] ?? null
    const payloadKind: string = binding?.payload ?? 'html'

    const targets: string[] = await makeTargets(project)
    const target: string | undefined = payloadKind === 'html' ? ['web', 'html', 'build'].find((name: string) => targets.includes(name)) : targets.includes('build') ? 'build' : undefined
    if (target && !(await runTarget(this.tasks, project, target))) {
      void vscode.window.showErrorMessage(`make ${target} failed; see the terminal.`)
      return
    }

    const payload: vscode.Uri | null = payloadKind === 'html' ? await findHtml(project) : await findPayload(project, payloadKind)
    if (!payload) {
      void vscode.window.showErrorMessage(payloadKind === 'html' ? 'No index.html of a web build was found.' : `No ${payloadKind} build was found.`)
      return
    }

    const shown: string = relative(project.folder.uri.fsPath, payload.fsPath)
    if (!binding) {
      const url: string = await this.server.serve(dirname(payload.fsPath))
      this.lastUrl = url
      this.show(project, { frame: url, external: url, frameOrigins: 'http://127.0.0.1:*', handoff: null, shown })
      return
    }

    const metadataWeb: unknown = project.metadata['web']
    const web: Record<string, unknown> = metadataWeb && typeof metadataWeb === 'object' ? metadataWeb as Record<string, unknown> : {}
    const frame: string = this.hosts.client().playPreviewUrl(project.platformName, 'message', {
      title: typeof project.metadata['title'] === 'string' ? project.metadata['title'] : project.name,
      params: web['params'] ?? null,
      start: typeof web['start'] === 'string' ? web['start'] : null,
      binding: typeof web['runtime'] === 'string' ? web['runtime'] : null
    })
    const name: string = basename(payload.fsPath)
    const base: string = await this.server.serve(dirname(payload.fsPath))
    this.server.page(BROWSER_PAGE, browserPage(frame, host, `/${encodeURIComponent(name)}`, name))
    this.lastUrl = frame
    this.show(project, {
      frame, external: `${base.replace(/\/$/, '')}${BROWSER_PAGE}`, frameOrigins: host,
      handoff: { name, base64: (await readFile(payload.fsPath)).toString('base64') }, shown
    })
  }

  public dispose(): void {
    this.panel?.dispose()
    void this.server.close()
  }

  private show(project: Project, view: { frame: string; external: string; frameOrigins: string; handoff: Handoff | null; shown: string }): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel('warpengine.play', 'Play', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true })
      this.panel.onDidDispose(() => { this.panel = null })
      this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
        if (message.type === 'external') void vscode.env.openExternal(vscode.Uri.parse(this.currentExternal))
        if (message.type === 'replay') void this.play()
      })
    }
    this.currentExternal = view.external
    const nonce: string = randomBytes(16).toString('base64')
    const hostOrigin: string = new URL(this.hosts.require().url).origin
    this.panel.title = `Play ${project.name}`
    this.panel.webview.html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${view.frameOrigins}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'">
<style>html,body{margin:0;height:100%;display:flex;flex-direction:column;background:var(--vscode-editor-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family)}
header{display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--vscode-panel-border);font-size:12px}
header span{flex:1;opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:0;padding:4px 10px;cursor:pointer}
iframe{flex:1;border:0;background:#000}</style></head><body>
<header><span>${escapeHtml(view.shown)}</span><button id="replay">Build and play again</button><button id="external">Open in browser</button></header>
<iframe id="game" src="${escapeHtml(view.frame)}" allow="autoplay; fullscreen; gamepad; screen-wake-lock" allowfullscreen></iframe>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi()
const handoff = ${JSON.stringify(view.handoff)}
const hostOrigin = ${JSON.stringify(hostOrigin)}
const frame = document.getElementById('game')
window.addEventListener('message', (event) => {
  if (!handoff || event.source !== frame.contentWindow || event.origin !== hostOrigin || !event.data || event.data.type !== 'warpengine.ready') return
  const bytes = Uint8Array.from(atob(handoff.base64), (c) => c.charCodeAt(0))
  frame.contentWindow.postMessage({ type: 'warpengine.payload', name: handoff.name, data: bytes.buffer }, hostOrigin, [bytes.buffer])
})
document.getElementById('external').onclick = () => vscode.postMessage({ type: 'external' })
document.getElementById('replay').onclick = () => vscode.postMessage({ type: 'replay' })
</script>
</body></html>`
    this.panel.reveal(vscode.ViewColumn.Beside, true)
  }

  private currentExternal = ''
}

function browserPage(frame: string, host: string, payloadPath: string, name: string): string {
  const origin: string = new URL(host).origin
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)}</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{width:100%;height:100%;border:0}</style></head><body>
<iframe id="game" src="${escapeHtml(frame)}" allow="autoplay; fullscreen; gamepad; screen-wake-lock" allowfullscreen></iframe>
<script>
const frame = document.getElementById('game')
const origin = ${JSON.stringify(origin)}
window.addEventListener('message', async (event) => {
  if (event.source !== frame.contentWindow || event.origin !== origin || !event.data || event.data.type !== 'warpengine.ready') return
  const data = await (await fetch(${JSON.stringify(payloadPath)})).arrayBuffer()
  frame.contentWindow.postMessage({ type: 'warpengine.payload', name: ${JSON.stringify(name)}, data }, origin, [data])
})
</script></body></html>`
}

async function findPayload(project: Project, kind: string): Promise<vscode.Uri | null> {
  const spec: KindDescription | undefined = project.platform?.kinds.find((candidate: KindDescription) => candidate.name === kind)
  const extension: string = spec ? spec.upload.replace(/^NAME-VERSION/, '') : ''
  if (!extension || extension.includes('-')) return null
  const found: vscode.Uri[] = await vscode.workspace.findFiles(new vscode.RelativePattern(project.folder, `**/*${extension}`), EXCLUDE, 200)
  const own: vscode.Uri | undefined = found.find((uri: vscode.Uri) => basename(uri.fsPath) === `${project.name}${extension}`)
  return own ?? newest(found)
}

async function findHtml(project: Project): Promise<vscode.Uri | null> {
  const found: vscode.Uri[] = await vscode.workspace.findFiles(new vscode.RelativePattern(project.folder, '**/index.html'), EXCLUDE, 200)
  const built: vscode.Uri[] = found.filter((uri: vscode.Uri) => /(^|[\\/])(dist|build|export|web|html|out|public)[\\/]/.test(relative(project.folder.uri.fsPath, uri.fsPath)))
  return newest(built.length > 0 ? built : found)
}

async function newest(uris: readonly vscode.Uri[]): Promise<vscode.Uri | null> {
  let best: { uri: vscode.Uri; time: number } | null = null
  for (const uri of uris) {
    const time: number = (await stat(uri.fsPath)).mtimeMs
    if (!best || time > best.time) best = { uri, time }
  }
  return best?.uri ?? null
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
