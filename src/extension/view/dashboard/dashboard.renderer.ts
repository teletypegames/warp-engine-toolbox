/**
 * The Dashboard page: the {@link extension/view/dashboard/dashboard.collector!DashboardData} as HTML tables.
 *
 * @packageDocumentation
 */

import { HealthChecks, type HealthCheck, type HealthSection, type HealthStatus } from '../../../domain/model/health.model'
import type { Message, Remedy } from '../../../domain/model/message.model'
import { PipelineRuns, type PipelineRun } from '../../../domain/model/pipeline.model'
import { Servers, type ServerContainer } from '../../../domain/model/server.model'
import type { SyncLink } from '../../../domain/model/sync.model'
import { WebviewHtml } from '../webview.html'
import type { DashboardCatalog, DashboardData, DashboardRelease, DashboardSoftware } from './dashboard.collector'

/** The button of a remedy on the page. */
export interface RemedyButton {
  /** The button's text. */
  readonly label: string
  /** The id of the command it runs. */
  readonly command: string
}

/** The texts and command ids the page needs, in the display language. */
export interface DashboardText {
  /**
   * Translates an English text with `{0}` placeholders.
   *
   * @param text - The text.
   * @param args - The placeholder values.
   * @returns The translation.
   */
  readonly t: (text: string, ...args: (string | number)[]) => string
  /**
   * Translates a domain message.
   *
   * @param message - The message.
   * @returns The translation.
   */
  readonly message: (message: Message) => string
  /**
   * Gives the button of a remedy.
   *
   * @param remedy - The remedy.
   * @returns Its label and the command id that performs it.
   */
  readonly remedy: (remedy: Remedy) => RemedyButton
  /**
   * Formats an ISO 8601 time for the reader.
   *
   * @param value - The time, or `null`.
   * @returns The local date and time, or an empty text.
   */
  readonly time: (value: string | null) => string
}

/** Where the page loads its style and script from, and the nonce of its script. */
export interface DashboardPage {
  /** The webview's CSP source. */
  readonly cspSource: string
  /** The script's nonce. */
  readonly nonce: string
  /** The style sheet's webview URI. */
  readonly style: string
  /** The script's webview URI. */
  readonly script: string
}

const esc = (text: string): string => WebviewHtml.escape(text)

/** Renders the Dashboard page; every text from the host or the project is escaped. */
export class DashboardRenderer {
  /**
   * Creates the renderer.
   *
   * @param text - The texts in the display language.
   */
  public constructor(private readonly text: DashboardText) {}

  /**
   * Renders the whole page: the header with the project's actions, then one card per part — Health, Pipeline,
   * Releases, Local Server, Sync, Catalog. Buttons carry a `data-command` (a catalog entry's *Open* a `data-open` with
   * the software name), links a `data-url`; the script posts them.
   *
   * @param data - What to show.
   * @param page - The CSP source, the nonce and the asset URIs.
   * @returns The HTML document.
   */
  public render(data: DashboardData, page: DashboardPage): string {
    const cards: string[] = [this.health(data.health), this.runs(data), this.releases(data), this.servers(data.containers), this.sync(data.sync), this.catalog(data.catalog)]
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${page.cspSource}; script-src 'nonce-${page.nonce}'">
<link rel="stylesheet" href="${page.style}"><title>WarpEngine</title></head>
<body>${this.header(data)}<main>${cards.filter(Boolean).join('')}</main>
<script nonce="${page.nonce}" src="${page.script}"></script></body></html>`
  }

  private header(data: DashboardData): string {
    const { t } = this.text
    const project = data.project
    const title: string = project ? esc(project.title) : esc(t('No WarpEngine project in this workspace'))
    const facts: string[] = project ? [project.platform, project.version ?? t('no version'), project.branch ?? ''] : []
    const host: string = data.host ? `<a data-url="${esc(data.host.url)}">${esc(data.host.name)}</a>` : esc(t('No host is set'))
    const actions: [string, string][] = project
      ? [['warpengine.play', t('Play')], ['warpengine.checkPublish', t('Check publish')], ['warpengine.release', t('Release…')], ['warpengine.triggerPipeline', t('Run Pipeline')]]
      : [['warpengine.newGame', t('New Game…')], ['warpengine.addToProject', t('Add WarpEngine to This Project')]]
    return `<header><div><h1>${title}</h1><p>${facts.filter(Boolean).map(esc).join(' · ')}${facts.length > 0 ? ' · ' : ''}${host}</p></div>
<nav>${actions.map(([command, label]) => DashboardRenderer.button(command, label)).join('')}${DashboardRenderer.button('warpengine.openDashboard', t('Refresh'), 'secondary')}</nav></header>`
  }

  private health(sections: readonly HealthSection[]): string {
    if (sections.length === 0) return ''
    const rows: string = sections.flatMap((section: HealthSection) => section.checks.map((check: HealthCheck, index: number) =>
      `<tr><td>${index === 0 ? esc(this.text.message(section.title)) : ''}</td><td>${DashboardRenderer.dot(check.status)}${esc(this.text.message(check.title))}</td>
<td>${check.detail ? esc(this.text.message(check.detail)) : ''}</td><td>${this.fix(check)}</td></tr>`)).join('')
    const worst: HealthStatus = HealthChecks.worst(sections.flatMap((section: HealthSection) => section.checks))
    return this.card(`${DashboardRenderer.dot(worst)}${esc(this.text.t('Health'))}`, `<table>${rows}</table>`, 'wide')
  }

  private fix(check: HealthCheck): string {
    if (check.remedy) {
      const remedy = this.text.remedy(check.remedy)
      return DashboardRenderer.button(remedy.command, remedy.label, 'small')
    }
    return check.url ? `<a data-url="${esc(check.url)}">${esc(this.text.t('Open'))}</a>` : ''
  }

  private runs(data: DashboardData): string {
    if (!data.project) return ''
    const { t } = this.text
    if (data.runs.length === 0) return this.card(esc(t('Pipeline')), `<p class="muted">${esc(t('No run yet'))}</p>`)
    const rows: string = data.runs.map((run: PipelineRun) => `<tr${run.commit === data.head ? ' class="head"' : ''}>
<td>${run.url ? `<a data-url="${esc(run.url)}">#${String(run.number)}</a>` : `#${String(run.number)}`}</td><td>${DashboardRenderer.dot(DashboardRenderer.runStatus(run))}${esc(run.status)}</td>
<td>${esc(run.event ?? '')}</td><td>${esc(run.branch ?? '')}</td><td><code>${esc(run.commit?.slice(0, 7) ?? '')}</code>${run.commit === data.head ? ` <span class="tag">HEAD</span>` : ''}</td>
<td>${esc(this.text.time(run.createdAt))}</td></tr>`).join('')
    return this.card(esc(t('Pipeline')), `<table><thead><tr><th>#</th><th>${esc(t('Status'))}</th><th>${esc(t('Event'))}</th><th>${esc(t('Branch'))}</th><th>${esc(t('Commit'))}</th><th>${esc(t('Started'))}</th></tr></thead>${rows}</table>`, 'wide')
  }

  private releases(data: DashboardData): string {
    if (!data.project) return ''
    const { t } = this.text
    const all: DashboardRelease[] = [...(data.branchBuild ? [data.branchBuild] : []), ...data.releases]
    if (all.length === 0) return this.card(esc(t('Releases')), `<p class="muted">${esc(t('No release yet'))}</p>`)
    const rows: string = all.map((item: DashboardRelease) => `<tr><td><b>${esc(item.release.version)}</b></td><td>${esc(item.release.channel ?? '')}</td>
<td><code>${esc(item.release.commitSha?.slice(0, 7) ?? '')}</code></td><td>${String(item.release.assets.length)}</td><td>${esc(this.text.time(item.release.createdAt))}</td>
<td>${item.playUrl ? `<a data-url="${esc(item.playUrl)}">${esc(t('Play'))}</a>` : ''}</td></tr>`).join('')
    return this.card(esc(t('Releases')), `<table><thead><tr><th>${esc(t('Version'))}</th><th>${esc(t('Channel'))}</th><th>${esc(t('Commit'))}</th><th>${esc(t('Files'))}</th><th>${esc(t('Created'))}</th><th></th></tr></thead>${rows}</table>`, 'wide')
  }

  private catalog(catalog: DashboardCatalog | null): string {
    const { t } = this.text
    if (!catalog) return this.card(esc(t('Catalog')), `<p class="muted">${esc(t('Sign in to see the catalog.'))}</p>${DashboardRenderer.button('warpengine.signIn', t('Sign in'), 'small')}`)
    const who: string = catalog.principal ? `<p class="muted">${esc(t('Signed in as {0}', catalog.principal))}</p>` : ''
    const head = `<thead><tr><th>${esc(t('Title'))}</th><th>${esc(t('Name'))}</th><th>${esc(t('Platform'))}</th><th>${esc(t('Status'))}</th><th>${esc(t('Category'))}</th><th>${esc(t('Project'))}</th></tr></thead>`
    const rows: string = catalog.softwares.map((row: DashboardSoftware) => `<tr${row.local === 'here' ? ' class="head"' : ''}><td>${row.software.highlighted ? '★ ' : ''}${esc(row.software.title)}</td>
<td><code>${esc(row.software.name)}</code></td><td>${esc(row.platform)}</td><td>${esc(row.software.status ?? '—')}</td><td>${esc(row.software.category ?? '—')}</td><td>${this.local(row)}</td></tr>`).join('')
    return this.card(`${esc(t('Catalog'))} <span class="count">${String(catalog.softwares.length)}</span>`, `${who}<table>${head}${rows}</table>`, 'wide')
  }

  private local(row: DashboardSoftware): string {
    if (row.local === 'here') return `<span class="tag">${esc(this.text.t('open'))}</span>`
    if (row.local === 'known') return `<button class="small" data-open="${esc(row.software.name)}">${esc(this.text.t('Open'))}</button>`
    return ''
  }

  private servers(containers: readonly ServerContainer[] | null): string {
    const { t } = this.text
    if (containers === null) return this.card(esc(t('Local Server')), `<p class="muted">${esc(t('Docker does not answer'))}</p>`)
    if (containers.length === 0) return this.card(esc(t('Local Server')), `<p class="muted">${esc(t('No WarpEngine container on this machine'))}</p>${DashboardRenderer.button('warpengine.installLocalEngine', t('Install a local engine'), 'small')}`)
    const rows: string = containers.map((container: ServerContainer) => {
      const url: string | null = Servers.url(container)
      const name: string = url ? `<a data-url="${esc(url)}">${esc(container.name)}</a>` : esc(container.name)
      return `<tr><td>${DashboardRenderer.dot(container.state === 'running' ? 'ok' : 'error')}${name}</td><td>${esc(container.status)}</td><td>${container.hostPorts.map((port: number) => `:${String(port)}`).join(' ')}</td></tr>`
    }).join('')
    return this.card(esc(t('Local Server')), `<table>${rows}</table>`)
  }

  private sync(links: readonly SyncLink[] | null): string {
    if (links === null) return ''
    const { t } = this.text
    if (links.length === 0) return this.card(esc(t('Sync')), `<p class="muted">${esc(t('This engine syncs nowhere yet.'))}</p>${DashboardRenderer.button('warpengine.syncTo', t('Sync to…'), 'small')}`)
    const rows: string = links.map((link: SyncLink) => `<tr><td>${DashboardRenderer.dot(link.peer.lastError ? 'error' : 'ok')}<a data-url="${esc(link.remoteUrl)}">${esc(link.peer.label)}</a></td>
<td>${esc(link.channels.join(' + '))}</td><td>${esc(link.peer.lastError ?? (link.peer.lastSyncedAt ? this.text.time(link.peer.lastSyncedAt) : t('nothing sent yet')))}</td></tr>`).join('')
    return this.card(esc(t('Sync')), `<table>${rows}</table>`)
  }

  private card(title: string, body: string, size: string = ''): string {
    return `<section class="card ${size}"><h2>${title}</h2>${body}</section>`
  }

  private static runStatus(run: PipelineRun): HealthStatus {
    if (PipelineRuns.isRunning(run)) return 'info'
    return PipelineRuns.isSuccess(run) ? 'ok' : 'error'
  }

  private static dot(status: HealthStatus): string {
    return `<span class="dot ${status}"></span>`
  }

  private static button(command: string, label: string, kind: string = ''): string {
    return `<button class="${kind}" data-command="${esc(command)}">${esc(label)}</button>`
  }
}
