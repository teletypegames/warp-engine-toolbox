import * as vscode from 'vscode'
import { AssetChecklist, type ChecklistEntry } from '../../domain/model/asset-checklist.model'
import type { Category, Software } from '../../domain/model/catalog.model'
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

export interface CatalogDependencies {
  readonly catalog: CatalogService
  readonly pipelines: PipelineService
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly reports: ReportView
  readonly tree: TreeProvider
}

export class CatalogController {
  public constructor(private readonly deps: CatalogDependencies) {}

  public async editField(node?: TreeNode): Promise<void> {
    const data: FieldData | undefined = node?.data as FieldData | undefined
    if (!(await this.deps.catalog.signIn()) || !data) return
    const value: unknown = await this.askField(data)
    if (value === undefined) return
    await this.deps.catalog.update(data.software, data.field, value)
    this.deps.tree.refresh()
  }

  public async deleteSoftware(node?: TreeNode): Promise<void> {
    const software: Software | undefined = node?.data as Software | undefined
    if (!software || !(await Dialogs.confirm(t('Delete {0} ({1}) from the catalog? It and its releases leave every listing.', software.title, software.name), t('Delete')))) return
    await this.deps.catalog.deleteSoftware(software)
    await this.afterDelete()
  }

  public async deleteRelease(node?: TreeNode): Promise<void> {
    const data: ReleaseData | undefined = node?.data as ReleaseData | undefined
    if (!data || !(await Dialogs.confirm(t('Delete the release {0} of {1} with its files?', data.release.version, data.name), t('Delete')))) return
    await this.deps.catalog.deleteRelease(data.release)
    await this.afterDelete()
  }

  public async showChecklist(node?: TreeNode): Promise<void> {
    const data: ReleaseData | undefined = node?.data as ReleaseData | undefined
    if (!data?.platform) return
    const lines: string[] = new AssetChecklist(data.platform, data.release.assets).entries.map((entry: ChecklistEntry) =>
      `- \`${AssetChecklist.mark(entry.state)}\` **${entry.kind}** ${entry.note ? translate(entry.note) : ''}`)
    await this.deps.reports.show(`${data.name}-${data.release.version}-checklist.md`, [`# ${data.name} ${data.release.version}`, '', ...lines, ''].join('\n'))
  }

  public async showStatistics(node?: TreeNode): Promise<void> {
    const software: Software | undefined = node?.data as Software | undefined
    if (!(await this.deps.catalog.signIn()) || !software) return
    const stats: unknown = await this.deps.catalog.downloadStats(software)
    await this.deps.reports.show(`${software.name}-downloads.md`, `# ${software.title}: ${t('downloads')}\n\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\`\n`)
  }

  public async triggerPipeline(node?: TreeNode): Promise<void> {
    const pipeline: Pipeline | null = (node?.data as Pipeline | undefined) ?? this.deps.states.current()?.pipeline ?? null
    if (!pipeline) return
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
