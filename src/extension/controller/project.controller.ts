import * as vscode from 'vscode'
import { DomainError, msg } from '../../domain/model/message.model'
import type { Release } from '../../domain/model/catalog.model'
import type { Project } from '../../domain/model/project.model'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { PipelineService } from '../../domain/service/pipeline.service'
import type { PlayService } from '../../domain/service/play.service'
import type { MakeTaskProvider } from '../language/make.task-provider'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { PublishDiagnostics } from '../view/diagnostics/publish.diagnostics'
import { METADATA_VIEW } from '../view/metadata/metadata.editor'
import type { PlayPanel } from '../view/play/play.panel'
import type { ReportView } from '../view/report/report.view'
import type { TreeNode } from '../view/tree/tree.node'
import type { ProjectRegistry } from '../workspace/project.registry'

export interface ProjectDependencies {
  readonly projects: ProjectRegistry
  readonly pipelines: PipelineService
  readonly play: PlayService
  readonly tasks: MakeTaskProvider
  readonly diagnostics: PublishDiagnostics
  readonly player: PlayPanel
  readonly reports: ReportView
}

export class ProjectController {
  public constructor(private readonly deps: ProjectDependencies) {}

  public async previewPipeline(): Promise<void> {
    const project: Project = this.deps.projects.require()
    await this.deps.reports.show(`${project.name}-pipeline.yaml`, await this.deps.pipelines.preview(project), false)
  }

  public async play(): Promise<void> {
    await this.deps.player.play()
  }

  public async buildLikeCi(): Promise<void> {
    const project: Project = this.deps.projects.require()
    if (!project.platform?.builder) throw new DomainError(msg('The host names no builder image for this platform.'))
    const ok: boolean = await this.deps.tasks.run(project, 'build', true)
    if (ok) Dialogs.info(t('The CI builder built it.'))
    else Dialogs.error(t('The CI builder failed; see the terminal.'))
  }

  public async checkPublish(): Promise<void> {
    await this.deps.diagnostics.check(this.deps.projects.require(), true)
  }

  public async editMetadata(uri?: vscode.Uri): Promise<void> {
    const target: vscode.Uri | null = uri ?? vscode.window.activeTextEditor?.document.uri ?? this.metadataUri()
    if (!target) throw new DomainError(msg('This project has no metadata file.'))
    await vscode.commands.executeCommand('vscode.openWith', target, target.path.endsWith('.json') ? METADATA_VIEW : 'default')
  }

  public async openPlatformDocs(node?: TreeNode): Promise<void> {
    const url: string | null = typeof node?.data === 'string' ? node.data : this.deps.projects.current()?.platform?.docsUrl ?? null
    if (!url) throw new DomainError(msg('The host links no documentation for this platform.'))
    await Dialogs.openExternal(url)
  }

  public async announceBranchBuild(state: RemoteState): Promise<void> {
    const build: Release | null = state.branchBuild
    const url: string | null = build ? this.deps.play.playUrl(state.project.name, build.version) : null
    if (!build || !url) return
    const playAction: string = t('Play')
    const copy: string = t('Copy link')
    const answer: string | undefined = await Dialogs.ask(t('The build of {0} is ready: {1}', state.branch ?? t('this branch'), build.version), playAction, copy)
    if (answer === playAction) await Dialogs.openExternal(url)
    if (answer === copy) await vscode.env.clipboard.writeText(url)
  }

  private metadataUri(): vscode.Uri | null {
    const path: string | null = this.deps.projects.current()?.metadataPath ?? null
    return path ? vscode.Uri.file(path) : null
  }
}
