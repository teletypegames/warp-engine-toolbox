import { randomBytes } from 'node:crypto'
import * as vscode from 'vscode'
import type { Project, Projects } from './project'
import type { SchemaProvider } from './schema'

export const METADATA_VIEW = 'warpengine.metadata'

interface FieldMessage {
  readonly type: 'set'
  readonly path: readonly string[]
  readonly value: unknown
}

export class MetadataEditor implements vscode.CustomTextEditorProvider {
  public constructor(private readonly schemas: SchemaProvider, private readonly projects: Projects) {}

  public async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = { enableScripts: true }
    const project: Project | undefined = this.projects.all().find((candidate: Project) => candidate.metadataUri?.toString() === document.uri.toString())
    const schema: string = project ? await this.schemas.schema(project.platformName) : '{}'
    const nonce: string = randomBytes(16).toString('base64')
    panel.webview.html = page(nonce, schema, project?.platform?.label ?? 'WarpEngine')

    const post = (): void => { void panel.webview.postMessage({ type: 'document', text: document.getText() }) }
    const changes: vscode.Disposable = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (event.document.uri.toString() === document.uri.toString()) post()
    })
    panel.onDidDispose(() => { changes.dispose() })
    panel.webview.onDidReceiveMessage(async (message: FieldMessage | { type: 'ready' } | { type: 'source' }) => {
      if (message.type === 'ready') post()
      if (message.type === 'source') await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default')
      if (message.type === 'set') await apply(document, message)
    })
  }
}

async function apply(document: vscode.TextDocument, message: FieldMessage): Promise<void> {
  let metadata: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(document.getText() || '{}')
    metadata = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    void vscode.window.showErrorMessage('metadata.json is not valid JSON; fix it in the text editor first.')
    return
  }
  setPath(metadata, message.path, message.value)
  const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), `${JSON.stringify(metadata, null, 2)}\n`)
  await vscode.workspace.applyEdit(edit)
}

function setPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  const [head, ...rest] = path
  if (head === undefined) return
  if (rest.length === 0) {
    if (value === '' || value === null || value === undefined) Reflect.deleteProperty(target, head)
    else target[head] = value
    return
  }
  const child: unknown = target[head]
  const next: Record<string, unknown> = child && typeof child === 'object' ? child as Record<string, unknown> : {}
  setPath(next, rest, value)
  if (Object.keys(next).length === 0) Reflect.deleteProperty(target, head)
  else target[head] = next
}

function page(nonce: string, schema: string, label: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'">
<style>
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:16px 24px;max-width:760px}
h1{font-size:18px;font-weight:600;margin:0 0 4px}p.lead{margin:0 0 18px;opacity:.75}
label{display:block;margin:14px 0 4px;font-weight:600}
.hint{font-weight:400;opacity:.7;font-size:12px;margin-left:6px}
input[type=text],textarea,select{width:100%;box-sizing:border-box;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);padding:5px 7px;font:inherit}
textarea{min-height:80px;resize:vertical}
fieldset{border:1px solid var(--vscode-panel-border);margin:22px 0 0;padding:4px 14px 14px}
legend{font-weight:600;padding:0 6px}
.row{display:flex;gap:8px;align-items:center;margin-top:12px}
button{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:0;padding:5px 12px;cursor:pointer;margin-top:18px}
.error{color:var(--vscode-errorForeground)}
</style></head><body>
<h1>${label} metadata</h1><p class="lead">What a publish takes over into the catalog. Changes are written to metadata.json as you type.</p>
<div id="form"></div><div id="error" class="error"></div>
<button id="source">Open as text</button>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi()
const schema = ${schema}
const props = schema.properties || {}
const order = ['name','title','version','author','desc','license','category','site','repo','shelf_name']
let data = {}
const form = document.getElementById('form')
function input(path, spec, value) {
  const id = path.join('.')
  const wrap = document.createElement('div')
  const label = document.createElement('label')
  label.htmlFor = id
  label.textContent = path[path.length - 1]
  if (spec.description) { const hint = document.createElement('span'); hint.className = 'hint'; hint.textContent = spec.description; label.appendChild(hint) }
  wrap.appendChild(label)
  let el
  if (spec.type === 'boolean') {
    el = document.createElement('select')
    for (const [text, val] of [['(not set)',''],['true','true'],['false','false']]) { const o = document.createElement('option'); o.value = val; o.textContent = text; el.appendChild(o) }
    el.value = value === undefined ? '' : String(value)
  } else if (Array.isArray(spec.enum)) {
    el = document.createElement('select')
    for (const val of ['', ...spec.enum]) { const o = document.createElement('option'); o.value = val; o.textContent = val || '(default)'; el.appendChild(o) }
    el.value = value ?? ''
  } else if (spec.type === 'object') {
    el = document.createElement('textarea')
    el.value = value === undefined ? '' : JSON.stringify(value, null, 2)
  } else if (path[path.length - 1] === 'desc') {
    el = document.createElement('textarea')
    el.value = value ?? ''
  } else {
    el = document.createElement('input'); el.type = 'text'; el.value = value ?? ''
    if (Array.isArray(spec.examples) && spec.examples.length) {
      const list = document.createElement('datalist'); list.id = id + '-list'
      for (const ex of spec.examples) { const o = document.createElement('option'); o.value = ex; list.appendChild(o) }
      wrap.appendChild(list); el.setAttribute('list', list.id)
    }
    if (spec.maxLength) el.maxLength = spec.maxLength
  }
  el.id = id
  el.addEventListener('change', () => {
    let v = el.value
    if (spec.type === 'boolean') v = v === '' ? null : v === 'true'
    if (spec.type === 'object') { if (v.trim() === '') v = null; else { try { v = JSON.parse(v); document.getElementById('error').textContent = '' } catch (e) { document.getElementById('error').textContent = id + ': not JSON'; return } } }
    vscode.postMessage({ type: 'set', path, value: v })
  })
  wrap.appendChild(el)
  return wrap
}
function render() {
  form.textContent = ''
  const keys = [...order.filter(k => props[k]), ...Object.keys(props).filter(k => !order.includes(k) && k !== 'web')]
  for (const key of keys) form.appendChild(input([key], props[key], data[key]))
  if (props.web && props.web.properties) {
    const set = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = 'Web play'; set.appendChild(legend)
    for (const [key, spec] of Object.entries(props.web.properties)) set.appendChild(input(['web', key], spec, (data.web || {})[key]))
    form.appendChild(set)
  }
}
window.addEventListener('message', (event) => {
  if (event.data.type !== 'document') return
  try { data = JSON.parse(event.data.text || '{}'); document.getElementById('error').textContent = ''; if (!form.contains(document.activeElement)) render() }
  catch (e) { document.getElementById('error').textContent = 'metadata.json is not valid JSON' }
})
document.getElementById('source').onclick = () => vscode.postMessage({ type: 'source' })
vscode.postMessage({ type: 'ready' })
</script></body></html>`
}
