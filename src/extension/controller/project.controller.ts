/**
 * The actions of the project view on the current project.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { DomainError, msg } from '../../domain/model/message.model'
import { Releases, type Release } from '../../domain/model/catalog.model'
import { PipelineRuns, type PipelineRun } from '../../domain/model/pipeline.model'
import type { Project } from '../../domain/model/project.model'
import { RemoteStates, type RemoteState } from '../../domain/model/remote-state.model'
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

/** What {@link ProjectController} works with. */
export interface ProjectDependencies {
  /** The current project. */
  readonly projects: ProjectRegistry
  /** The host's preview of the project's pipeline. */
  readonly pipelines: PipelineService
  /** The play link of a branch build. */
  readonly play: PlayService
  /** Runs Makefile targets, also in the CI builder image. */
  readonly tasks: MakeTaskProvider
  /** Checks the metadata against the host. */
  readonly diagnostics: PublishDiagnostics
  /** The Play panel. */
  readonly player: PlayPanel
  /** Shows the pipeline preview. */
  readonly reports: ReportView
}

/**
 * Serves `warpengine.previewPipeline`, `warpengine.play`, `warpengine.buildLikeCi`, `warpengine.checkPublish`, `warpengine.editMetadata` and `warpengine.openPlatformDocs`, and announces branch builds.
 */
export class ProjectController {
  /**
   * Creates the controller.
   *
   * @param deps - The services and views it uses.
   */
  public constructor(private readonly deps: ProjectDependencies) {}

  /**
   * `warpengine.previewPipeline`: shows the full pipeline the host serves for the current project as a YAML document.
   *
   * @throws {@link "domain/model/message.model".DomainError} When there is no current project.
   */
  public async previewPipeline(): Promise<void> {
    const project: Project = this.deps.projects.require()
    await this.deps.reports.show(`${project.name}-pipeline.yaml`, await this.deps.pipelines.preview(project), false)
  }

  /** `warpengine.play`: builds the current project and plays it in the {@link PlayPanel}. */
  public async play(): Promise<void> {
    await this.deps.player.play()
  }

  /**
   * `warpengine.buildLikeCi`: runs the `build` target in the platform's CI builder image (Docker) in a terminal, and reports success or failure in a notification.
   *
   * @throws {@link "domain/model/message.model".DomainError} When there is no current project or the host names no builder image for its platform.
   */
  public async buildLikeCi(): Promise<void> {
    const project: Project = this.deps.projects.require()
    if (!project.platform?.builder) throw new DomainError(msg('The host names no builder image for this platform.'))
    const ok: boolean = await this.deps.tasks.run(project, 'build', true)
    if (ok) Dialogs.info(t('The CI builder built it.'))
    else Dialogs.error(t('The CI builder failed; see the terminal.'))
  }

  /**
   * `warpengine.checkPublish`: asks the host what a publish would refuse in the current project's metadata, shows the problems as diagnostics and reports the result.
   *
   * @throws {@link "domain/model/message.model".DomainError} When there is no current project.
   */
  public async checkPublish(): Promise<void> {
    await this.deps.diagnostics.check(this.deps.projects.require(), true)
  }

  /**
   * `warpengine.editMetadata`: opens a metadata file, a JSON one in the metadata form and any other as text.
   *
   * @param uri - The file; without one, the active editor's document or the current project's metadata file.
   * @throws {@link "domain/model/message.model".DomainError} When there is no metadata file to open.
   */
  public async editMetadata(uri?: vscode.Uri): Promise<void> {
    const target: vscode.Uri | null = uri ?? vscode.window.activeTextEditor?.document.uri ?? this.metadataUri()
    if (!target) throw new DomainError(msg('This project has no metadata file.'))
    await vscode.commands.executeCommand('vscode.openWith', target, target.path.endsWith('.json') ? METADATA_VIEW : 'default')
  }

  /**
   * `warpengine.openPlatformDocs`: opens the host's documentation page of the platform in the browser.
   *
   * @param node - The platform node carrying the docs URL; without one, the current project's platform docs.
   * @throws {@link "domain/model/message.model".DomainError} When the host links no documentation for the platform.
   */
  public async openPlatformDocs(node?: TreeNode): Promise<void> {
    const url: string | null = typeof node?.data === 'string' ? node.data : this.deps.projects.current()?.platform?.docsUrl ?? null
    if (!url) throw new DomainError(msg('The host links no documentation for this platform.'))
    await Dialogs.openExternal(url)
  }

  /**
   * Announces the end of the run of `HEAD`: a failure with a button to its log; a success with the release it
   * published, offering to play it or copy its link. A development build is left to {@link ProjectController.announceBranchBuild}.
   *
   * @param state - The remote state loaded after the run ended.
   */
  public async announceRunEnd(state: RemoteState): Promise<void> {
    const run: PipelineRun | null = state.headRun
    if (!run) return
    if (!PipelineRuns.isSuccess(run)) {
      await ProjectController.announceFailure(state, run)
      return
    }
    const release: Release | null = RemoteStates.releaseOf(state, run)
    if (release && Releases.isDev(release)) return
    if (!release) {
      Dialogs.info(t('Pipeline #{0} of {1} passed; it published no release.', run.number, state.project.name))
      return
    }
    await this.offerPlay(t('{0} {1} is published.', state.project.title, release.version), this.deps.play.playUrl(state.project.name, release.version))
  }

  /**
   * Announces that a push to a side branch was built: a notification offers to play the build or copy its link.
   *
   * @param state - The remote state with the branch build; without a build or a play link nothing is shown.
   */
  public async announceBranchBuild(state: RemoteState): Promise<void> {
    const build: Release | null = state.branchBuild
    if (!build) return
    await this.offerPlay(t('The build of {0} is ready: {1}', state.branch ?? t('this branch'), build.version), this.deps.play.playUrl(state.project.name, build.version))
  }

  private static async announceFailure(state: RemoteState, run: PipelineRun): Promise<void> {
    const log: string = t('Open the log')
    const answer: string | undefined = await Dialogs.alert(t('Pipeline #{0} of {1} ended: {2}.', run.number, state.project.name, run.status), ...(run.url ? [log] : []))
    if (answer === log && run.url) await Dialogs.openExternal(run.url)
  }

  private async offerPlay(message: string, url: string | null): Promise<void> {
    if (!url) {
      Dialogs.info(message)
      return
    }
    const playAction: string = t('Play')
    const copy: string = t('Copy link')
    const answer: string | undefined = await Dialogs.ask(message, playAction, copy)
    if (answer === playAction) await Dialogs.openExternal(url)
    if (answer === copy) await vscode.env.clipboard.writeText(url)
  }

  private metadataUri(): vscode.Uri | null {
    const path: string | null = this.deps.projects.current()?.metadataPath ?? null
    return path ? vscode.Uri.file(path) : null
  }
}
