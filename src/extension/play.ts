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

export class Player implements vscode.Disposable {
  private readonly server: PreviewServer = new PreviewServer()
  private panel: vscode.WebviewPanel | null = null
  private external = ''
  private handoff: { name: string; bytes: Uint8Array } | null = null
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
    const base: string = await this.server.serve(dirname(payload.fsPath))
    const panel: vscode.WebviewPanel = this.ensurePanel(project)

    if (!binding) {
      this.handoff = null
      this.external = base
      this.lastUrl = base
      panel.webview.html = await localPage(panel.webview, payload, shown)
      return
    }

    const metadataWeb: unknown = project.metadata['web']
    const web: Record<string, unknown> = metadataWeb && typeof metadataWeb === 'object' ? metadataWeb as Record<string, unknown> : {}
    const preview: string = this.hosts.client().playPreviewUrl(project.platformName, 'message', {
      title: typeof project.metadata['title'] === 'string' ? project.metadata['title'] : project.name,
      params: web['params'] ?? null,
      start: typeof web['start'] === 'string' ? web['start'] : null,
      binding: typeof web['runtime'] === 'string' ? web['runtime'] : null
    })
    const response: Response = await fetch(preview, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`${host} answered ${String(response.status)} for the play preview`)
    const name: string = basename(payload.fsPath)
    this.server.proxy('/file/', host)
    this.server.page(BROWSER_PAGE, browserPage(preview, host, `/${encodeURIComponent(name)}`, name))
    this.handoff = { name, bytes: new Uint8Array(await readFile(payload.fsPath)) }
    this.external = `${base.replace(/\/$/, '')}${BROWSER_PAGE}`
    this.lastUrl = preview
    panel.webview.html = runtimePage(await response.text(), base, shown)
  }

  public dispose(): void {
    this.panel?.dispose()
    void this.server.close()
  }

  private ensurePanel(project: Project): vscode.WebviewPanel {
    if (!this.panel) {
      const roots: vscode.Uri[] = (vscode.workspace.workspaceFolders ?? []).map((folder: vscode.WorkspaceFolder) => folder.uri)
      this.panel = vscode.window.createWebviewPanel('warpengine.play', 'Play', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: roots })
      this.panel.onDidDispose(() => { this.panel = null })
      this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
        if (message.type === 'external') void vscode.env.openExternal(vscode.Uri.parse(this.external))
        if (message.type === 'replay') void this.play()
        if (message.type === 'ready' && this.handoff && this.panel) {
          void this.panel.webview.postMessage({ type: 'warpengine.payload', name: this.handoff.name, data: this.handoff.bytes })
        }
      })
    }
    this.panel.title = `Play ${project.name}`
    this.panel.reveal(vscode.ViewColumn.Beside, true)
    return this.panel
  }
}

const START_HINT = '<div id="warpengine-start">Click to start<small>the browser lets the game\u2019s sound start only after a click</small></div>'
const START_STYLE = '#warpengine-start{position:fixed;inset:0;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;z-index:2147483646;pointer-events:none;color:#e6edf3;font:600 18px var(--vscode-font-family,system-ui);text-shadow:0 1px 3px #000}#warpengine-start small{font-weight:400;font-size:12px;opacity:.7}'
const TOOLBAR_STYLE = '#warpengine-toolbar{position:fixed;top:8px;right:8px;z-index:2147483647;display:flex;gap:6px;font:12px var(--vscode-font-family,system-ui);opacity:.35;transition:opacity .15s}#warpengine-toolbar:hover{opacity:1}#warpengine-toolbar span{color:#ccc;align-self:center;margin-right:4px}#warpengine-toolbar button{background:var(--vscode-button-secondaryBackground,#333);color:var(--vscode-button-secondaryForeground,#eee);border:0;padding:4px 10px;cursor:pointer;border-radius:3px}'

function toolbar(nonce: string, shown: string, announceReady: boolean): string {
  return `${announceReady ? START_HINT : ''}<div id="warpengine-toolbar"><span>${escapeHtml(shown)}</span><button id="warpengine-replay">Build and play again</button><button id="warpengine-external">Open in browser</button></div>
<script nonce="${nonce}">
const warpengineApi = acquireVsCodeApi()
document.getElementById('warpengine-external').onclick = () => warpengineApi.postMessage({ type: 'external' })
document.getElementById('warpengine-replay').onclick = () => warpengineApi.postMessage({ type: 'replay' })
${announceReady ? "addEventListener('pointerdown', () => document.getElementById('warpengine-start')?.remove(), { once: true, capture: true }); if (typeof navigator.getAutoplayPolicy === 'function' && navigator.getAutoplayPolicy('audiocontext') === 'allowed') document.getElementById('warpengine-start')?.remove()" : ''}
${announceReady ? "addEventListener('message', (event) => { if (event.source !== window && event.data && event.data.type === 'warpengine.payload') window.postMessage(event.data, '*') }); addEventListener('DOMContentLoaded', () => warpengineApi.postMessage({ type: 'ready' }))" : ''}
</script>`
}

export function runtimePage(html: string, base: string, shown: string): string {
  const nonce: string = randomBytes(16).toString('base64')
  const local: string = base.replace(/\/$/, '')
  const csp: string = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${local} 'unsafe-eval' 'wasm-unsafe-eval' blob:`,
    `style-src 'unsafe-inline' ${local}`,
    `img-src ${local} data: blob:`,
    `font-src ${local} data:`,
    `connect-src ${local} blob: data:`,
    `worker-src ${local} blob:`,
    `media-src ${local} blob:`
  ].join('; ')
  const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><base href="${escapeHtml(base)}"><style>${TOOLBAR_STYLE}${START_STYLE}</style>`
  return html
    .replace(/<head>/i, `<head>${head}`)
    .replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
    .replace(/<\/body>/i, `${toolbar(nonce, shown, true)}</body>`)
}

async function localPage(webview: vscode.Webview, index: vscode.Uri, shown: string): Promise<string> {
  const nonce: string = randomBytes(16).toString('base64')
  const folder: string = webview.asWebviewUri(vscode.Uri.file(dirname(index.fsPath))).toString()
  const source: string = webview.cspSource
  const csp: string = [
    "default-src 'none'",
    `script-src ${source} 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:`,
    `style-src ${source} 'unsafe-inline'`,
    `img-src ${source} data: blob:`,
    `font-src ${source} data:`,
    `connect-src ${source} blob: data:`,
    `worker-src ${source} blob:`,
    `media-src ${source} blob:`
  ].join('; ')
  const html: string = (await readFile(index.fsPath)).toString('utf8')
  const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><base href="${folder}/"><style>${TOOLBAR_STYLE}</style>`
  const withHead: string = /<head>/i.test(html) ? html.replace(/<head>/i, `<head>${head}`) : `${head}${html}`
  return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${toolbar(nonce, shown, false)}</body>`) : `${withHead}${toolbar(nonce, shown, false)}`
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
