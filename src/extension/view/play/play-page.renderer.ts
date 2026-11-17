import { WebviewHtml } from '../webview.html'

export interface PlayAssets {
  readonly style: string
  readonly toolbar: string
  readonly start: string
  readonly relay: string
  readonly handoff: string
}

export interface PlayTexts {
  readonly replay: string
  readonly external: string
  readonly clickToStart: string
  readonly soundHint: string
}

export interface LocalPage {
  readonly html: string
  readonly folder: string
  readonly cspSource: string
  readonly shown: string
}

export class PlayPageRenderer {
  public constructor(private readonly assets: PlayAssets, private readonly texts: PlayTexts) {}

  public runtime(html: string, base: string, shown: string): string {
    const nonce: string = WebviewHtml.nonce()
    const local: string = base.replace(/\/$/, '')
    const csp: string = PlayPageRenderer.csp(`'nonce-${nonce}' ${local} 'unsafe-eval' 'wasm-unsafe-eval' blob:`, local)
    const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><base href="${WebviewHtml.escape(base)}"><style>${this.assets.style}</style>`
    return html
      .replace(/<head>/i, `<head>${head}`)
      .replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
      .replace(/<\/body>/i, `${this.startHint()}${this.toolbar(nonce, shown, true)}</body>`)
  }

  public browser(html: string, payloadPath: string, name: string): string {
    const handoff = `<script type="application/json" id="warpengine-handoff">${WebviewHtml.json({ path: payloadPath, name })}</script><script>${this.assets.handoff}</script>`
    const hint = `${this.startHint()}<script>${this.assets.start}</script>`
    return html.replace(/<head>/i, `<head><base href="/"><style>${this.assets.style}</style>`).replace(/<\/body>/i, `${hint}${handoff}</body>`)
  }

  public local(page: LocalPage): string {
    const nonce: string = WebviewHtml.nonce()
    const csp: string = PlayPageRenderer.csp(`${page.cspSource} 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:`, page.cspSource)
    const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><base href="${page.folder}/"><style>${this.assets.style}</style>`
    const withHead: string = /<head>/i.test(page.html) ? page.html.replace(/<head>/i, `<head>${head}`) : `${head}${page.html}`
    const toolbar: string = this.toolbar(nonce, page.shown, false)
    return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${toolbar}</body>`) : `${withHead}${toolbar}`
  }

  private toolbar(nonce: string, shown: string, announceReady: boolean): string {
    const scripts: string = [this.assets.toolbar, ...(announceReady ? [this.assets.start, this.assets.relay] : [])].join('\n')
    return `<div id="warpengine-toolbar"><span>${WebviewHtml.escape(shown)}</span><button id="warpengine-replay">${WebviewHtml.escape(this.texts.replay)}</button><button id="warpengine-external">${WebviewHtml.escape(this.texts.external)}</button></div>
<script nonce="${nonce}">
${scripts}
</script>`
  }

  private startHint(): string {
    return `<div id="warpengine-start">${WebviewHtml.escape(this.texts.clickToStart)}<small>${WebviewHtml.escape(this.texts.soundHint)}</small></div>`
  }

  private static csp(scripts: string, local: string): string {
    return [
      "default-src 'none'",
      `script-src ${scripts}`,
      `style-src 'unsafe-inline' ${local}`,
      `img-src ${local} data: blob:`,
      `font-src ${local} data:`,
      `connect-src ${local} blob: data:`,
      `worker-src ${local} blob:`,
      `media-src ${local} blob:`
    ].join('; ')
  }
}
