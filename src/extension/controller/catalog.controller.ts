/**
 * The actions of the catalog view: software fields, deletes, the asset checklist, download statistics and pipelines.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { AssetChecklist, type ChecklistEntry } from '../../domain/model/asset-checklist.model'
import type { Category, Software } from '../../domain/model/catalog.model'
import { DomainError, msg } from '../../domain/model/message.model'
import type { Pipeline } from '../../domain/model/pipeline.model'
import type { CatalogService } from '../../domain/service/catalog.service'
import type { PipelineService } from '../../domain/service/pipeline.service'
import { Dialogs, type PickItem } from '../ui/dialogs'
import { t, translate } from '../ui/l10n'
import type { ReportView } from '../view/report/report.view'
import type { ReleaseData } from '../view/tree/release.node'
import type { FieldData } from '../view/tree/catalog.tree-view'
import type { TreeNode } from '../view/tree/tree.node'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

/** What {@link CatalogController} works with. */
export interface CatalogDependencies {
  /** The host's catalog. */
  readonly catalog: CatalogService
  /** Starts pipelines. */
  readonly pipelines: PipelineService
  /** The current project, whose branch a started pipeline builds. */
  readonly projects: ProjectRegistry
  /** The current project's state on the host, refreshed or polled after a change. */
  readonly states: RemoteStateStore
  /** Shows the checklist and the statistics as documents. */
  readonly reports: ReportView
  /** The catalog view, redrawn after a change. */
  readonly tree: TreeProvider
}

/**
 * Serves the commands of the catalog view: `warpengine.editSoftwareField`, `warpengine.deleteSoftware`, `warpengine.deleteRelease`, `warpengine.showChecklist`, `warpengine.showStatistics` and `warpengine.triggerPipeline`.
 */
export class CatalogController {
  /**
   * Creates the controller.
   *
   * @param deps - The services, stores and views it uses.
   */
  public constructor(private readonly deps: CatalogDependencies) {}

  /**
   * `warpengine.editSoftwareField`: asks for a new value of a software field (title, status, category or highlight) and saves it on the host.
   *
   * Signs in first if needed; redraws the catalog view.
   *
   * @param node - The field node ({@link FieldData}); without one nothing happens.
   */
  public async editField(node?: TreeNode): Promise<void> {
    const data: FieldData | undefined = node?.data as FieldData | undefined
    if (!(await this.deps.catalog.signIn()) || !data) return
    const value: unknown = await this.askField(data)
    if (value === undefined) return
    await this.deps.catalog.update(data.software, data.field, value)
    this.deps.tree.refresh()
  }

  /**
   * `warpengine.deleteSoftware`: after a confirmation, deletes a software and its releases from the catalog.
   *
   * Redraws the catalog view and refreshes the remote state.
   *
   * @param node - The software node; without one nothing happens.
   */
  public async deleteSoftware(node?: TreeNode): Promise<void> {
    const software: Software | undefined = node?.data as Software | undefined
    if (!software || !(await Dialogs.confirm(t('Delete {0} ({1}) from the catalog? It and its releases leave every listing.', software.title, software.name), t('Delete')))) return
    await this.deps.catalog.deleteSoftware(software)
    await this.afterDelete()
  }

  /**
   * `warpengine.deleteRelease`: after a confirmation, deletes a release and its files from the catalog.
   *
   * Redraws the catalog view and refreshes the remote state.
   *
   * @param node - The release node ({@link ReleaseData}); without one nothing happens.
   */
  public async deleteRelease(node?: TreeNode): Promise<void> {
    const data: ReleaseData | undefined = node?.data as ReleaseData | undefined
    if (!data || !(await Dialogs.confirm(t('Delete the release {0} of {1} with its files?', data.release.version, data.name), t('Delete')))) return
    await this.deps.catalog.deleteRelease(data.release)
    await this.afterDelete()
  }

  /**
   * `warpengine.showChecklist`: shows the asset checklist of a release (what the platform publishes, what is there, what is missing) as a Markdown document.
   *
   * @param node - The release node ({@link ReleaseData}); without one, or without a known platform, nothing happens.
   */
  public async showChecklist(node?: TreeNode): Promise<void> {
    const data: ReleaseData | undefined = node?.data as ReleaseData | undefined
    if (!data?.platform) return
    const lines: string[] = new AssetChecklist(data.platform, data.release.assets).entries.map((entry: ChecklistEntry) =>
      `- \`${AssetChecklist.mark(entry.state)}\` **${entry.kind}** ${entry.note ? translate(entry.note) : ''}`)
    await this.deps.reports.show(`${data.name}-${data.release.version}-checklist.md`, [`# ${data.name} ${data.release.version}`, '', ...lines, ''].join('\n'))
  }

  /**
   * `warpengine.showStatistics`: fetches the download statistics of a software and shows them as a Markdown document.
   *
   * Signs in first if needed.
   *
   * @param node - The software node; without one nothing happens.
   */
  public async showStatistics(node?: TreeNode): Promise<void> {
    const software: Software | undefined = node?.data as Software | undefined
    if (!(await this.deps.catalog.signIn()) || !software) return
    const stats: unknown = await this.deps.catalog.downloadStats(software)
    await this.deps.reports.show(`${software.name}-downloads.md`, `# ${software.title}: ${t('downloads')}\n\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\`\n`)
  }

  /**
   * `warpengine.triggerPipeline`: starts a run of a pipeline and reports its number and branch in a notification.
   *
   * Then polls the remote state, so the status bar and the project view follow the run.
   *
   * @param node - The pipeline node; without one, the current project's pipeline is started.
   * @throws {@link "domain/model/message.model".DomainError} Without a node, when the current project has no pipeline.
   */
  public async triggerPipeline(node?: TreeNode): Promise<void> {
    const pipeline: Pipeline | null = (node?.data as Pipeline | undefined) ?? this.deps.states.current()?.pipeline ?? null
    if (!pipeline) throw new DomainError(msg('This project has no pipeline on the host yet.'))
    const started = await this.deps.pipelines.trigger(pipeline, this.deps.projects.current())
    if (!started) return
    Dialogs.info(t('Pipeline #{0} started on {1}.', started.run.number, started.branch))
    this.deps.states.watch()
  }

  private async afterDelete(): Promise<void> {
    this.deps.tree.refresh()
    await this.deps.states.refresh()
  }

  private async askField(data: FieldData): Promise<unknown> {
    switch (data.field) {
      case 'highlighted': return this.askHighlight(data.software)
      case 'category': return this.askCategory()
      case 'status': return vscode.window.showQuickPick(await this.deps.catalog.statuses(), { title: t('Status') })
      case 'title': return Dialogs.input({ title: t('Title'), value: data.software.title })
    }
  }

  private async askHighlight(software: Software): Promise<boolean | undefined> {
    return Dialogs.pick<boolean>([{ label: t('yes'), value: true }, { label: t('no'), value: false }], { title: t('Highlight {0}?', software.title) })
  }

  private async askCategory(): Promise<string | null | undefined> {
    const categories: Category[] = await this.deps.catalog.categories()
    const items: PickItem<string | null>[] = [{ label: t('(none)'), value: null }, ...categories.map((item: Category) => ({ label: item.label, description: item.key, value: item.key }))]
    return Dialogs.pick(items, { title: t('Category') })
  }
}
