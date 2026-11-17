import { randomBytes } from 'node:crypto'

const START_HINT = '<div id="warpengine-start">Click to start<small>the browser lets the game\u2019s sound start only after a click</small></div>'

export const START_STYLE = '#warpengine-start{position:fixed;inset:0;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;z-index:2147483646;pointer-events:none;color:#e6edf3;font:600 18px var(--vscode-font-family,system-ui);text-shadow:0 1px 3px #000}#warpengine-start small{font-weight:400;font-size:12px;opacity:.7}'

export const TOOLBAR_STYLE = '#warpengine-toolbar{position:fixed;top:8px;right:8px;z-index:2147483647;display:flex;gap:6px;font:12px var(--vscode-font-family,system-ui);opacity:.35;transition:opacity .15s}#warpengine-toolbar:hover{opacity:1}#warpengine-toolbar span{color:#ccc;align-self:center;margin-right:4px}#warpengine-toolbar button{background:var(--vscode-button-secondaryBackground,#333);color:var(--vscode-button-secondaryForeground,#eee);border:0;padding:4px 10px;cursor:pointer;border-radius:3px}'

export function toolbar(nonce: string, shown: string, announceReady: boolean): string {
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

export function browserPage(html: string, payloadPath: string, name: string): string {
  const handoff = `<script>addEventListener('DOMContentLoaded', async () => { const data = await (await fetch(${JSON.stringify(payloadPath)})).arrayBuffer(); window.postMessage({ type: 'warpengine.payload', name: ${JSON.stringify(name)}, data }, '*', [data]) })</script>`
  const hint = `${START_HINT}<script>addEventListener('pointerdown', () => document.getElementById('warpengine-start')?.remove(), { once: true, capture: true }); if (typeof navigator.getAutoplayPolicy === 'function' && navigator.getAutoplayPolicy('audiocontext') === 'allowed') document.getElementById('warpengine-start')?.remove()</script>`
  return html.replace(/<head>/i, `<head><base href="/"><style>${START_STYLE}</style>`).replace(/<\/body>/i, `${hint}${handoff}</body>`)
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
