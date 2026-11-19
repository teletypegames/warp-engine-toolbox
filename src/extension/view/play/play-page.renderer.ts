/**
 * The HTML of the Play panel and of the browser page: the game page with the toolbar, the start hint and a content security policy.
 *
 * @packageDocumentation
 */

import { WebviewHtml } from '../webview.html'

/** The contents of the Play webview assets in `media/webview`, inlined into the pages. */
export interface PlayAssets {
  /** The stylesheet (`play.css`). */
  readonly style: string
  /** The toolbar script (`play-toolbar.js`): replay and open in the browser. */
  readonly toolbar: string
  /** The click-to-start script (`play-start.js`). */
  readonly start: string
  /** The script that relays the runtime page's readiness to the extension (`play-relay.js`). */
  readonly relay: string
  /** The script that hands the local build to the runtime page (`play-handoff.js`). */
  readonly handoff: string
}

/** The translated texts of the Play pages. */
export interface PlayTexts {
  /** The label of the build-and-play-again button. */
  readonly replay: string
  /** The label of the open-in-browser button. */
  readonly external: string
  /** The start hint. */
  readonly clickToStart: string
  /** Why a click is needed: the browser starts the sound only after one. */
  readonly soundHint: string
}

/** A web build to show in the panel as it is. */
export interface LocalPage {
  /** The HTML of its `index.html`. */
  readonly html: string
  /** The webview URI of its folder, the base of its relative URLs. */
  readonly folder: string
  /** The webview's content security policy source. */
  readonly cspSource: string
  /** The path of the payload shown in the toolbar. */
  readonly shown: string
}

/** Renders the pages of Play from the host page or the local web build, with the toolbar and the start hint. */
export class PlayPageRenderer {
  /**
   * Creates the renderer.
   *
   * @param assets - The inlined scripts and stylesheet.
   * @param texts - The translated texts.
   */
  public constructor(private readonly assets: PlayAssets, private readonly texts: PlayTexts) {}

  /**
   * Renders the host's runtime page (an emulator or a fantasy console player) for the panel, served from the local preview server.
   *
   * Adds a content security policy and the base URL, puts a nonce on every script, and appends the start hint and the toolbar.
   *
   * @param html - The host's play page.
   * @param base - The preview server URL the page is served from.
   * @param shown - The path of the payload shown in the toolbar.
   * @returns The panel HTML.
   */
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

  /**
   * Renders the host's runtime page for the browser: the start hint and a handoff that loads the local build from the preview server.
   *
   * @param html - The host's play page.
   * @param payloadPath - The path of the build on the preview server.
   * @param name - The file name of the build.
   * @returns The page HTML the preview server serves.
   */
  public browser(html: string, payloadPath: string, name: string): string {
    const handoff = `<script type="application/json" id="warpengine-handoff">${WebviewHtml.json({ path: payloadPath, name })}</script><script>${this.assets.handoff}</script>`
    const hint = `${this.startHint()}<script>${this.assets.start}</script>`
    return html.replace(/<head>/i, `<head><base href="/"><style>${this.assets.style}</style>`).replace(/<\/body>/i, `${hint}${handoff}</body>`)
  }

  /**
   * Renders a local web build for the panel, with a content security policy, the base URL and the toolbar.
   *
   * @param page - The build and its folder.
   * @returns The panel HTML.
   */
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
