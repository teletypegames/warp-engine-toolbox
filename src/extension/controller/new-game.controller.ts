/**
 * New Game…, Add WarpEngine to This Project and Add Dev Container: a project, or its dev container, from the host's template.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { DevContainer } from '../../domain/model/dev-container.model'
import type { GameAnswers } from '../../domain/model/game-answers.model'
import { FilePath } from '../../domain/model/path.model'
import type { Platform } from '../../domain/model/platform.model'
import type { Project } from '../../domain/model/project.model'
import type { HostService } from '../../domain/service/host.service'
import type { ScaffoldService, WriteResult } from '../../domain/service/scaffold.service'
import { Dialogs } from '../ui/dialogs'
import { FolderOpenDialog } from '../ui/folder-open.dialog'
import type { GameAnswersDialog } from '../ui/game-answers.dialog'
import { t } from '../ui/l10n'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { ConnectController } from './connect.controller'
import type { HostController } from './host.controller'

interface NewGame {
  readonly platform: Platform
  readonly answers: GameAnswers
  readonly folder: string
  readonly withDemo: boolean
}

/** What {@link NewGameController} works with. */
export interface NewGameDependencies {
  /** The current host, whose address the project gets. */
  readonly hosts: HostService
  /** Asks for a host when none is set. */
  readonly hostController: HostController
  /** Asks for the platform and the game answers. */
  readonly dialog: GameAnswersDialog
  /** Writes the project from the host's template and demo. */
  readonly scaffold: ScaffoldService
  /** The projects of the workspace, re-read after WarpEngine was added. */
  readonly projects: ProjectRegistry
  /** Connects the project when the user asks for it. */
  readonly connect: ConnectController
  /** Offers to open the new project. */
  readonly opener: FolderOpenDialog
}

/** Serves `warpengine.newGame`, `warpengine.addToProject` and `warpengine.addDevContainer`. */
export class NewGameController {
  /**
   * Creates the controller.
   *
   * @param deps - The services, dialogs and controllers it uses.
   */
  public constructor(private readonly deps: NewGameDependencies) {}

  /**
   * `warpengine.newGame`: asks for the host, the platform, the game answers, the parent folder and the starting point (demo or template only), then writes the new project, with a progress notification.
   *
   * Offers to open the new folder (in its dev container too, when the template gave it one and the Dev Containers
   * extension is installed) or add it to the workspace; once it is open, {@link extension/controller/connect.controller!ConnectController.offer}
   * offers to connect it. Shows an error when the folder exists already.
   */
  public async newGame(): Promise<void> {
    const game: NewGame | null = await this.askNewGame()
    if (!game) return
    const result: WriteResult = await Dialogs.progress(t('WarpEngine: creating {0}', game.answers.title), async (report) =>
      this.deps.scaffold.createGame({ ...game, host: this.deps.hosts.require().url, overwrite: true, report }))
    await this.offerOpen(game, result)
  }

  /**
   * `warpengine.addDevContainer`: adds the dev container of the platform's template to the current project, keeping its own files and merging the template's tasks into `.vscode/tasks.json`; reports what was written, kept and merged.
   *
   * @throws {@link domain/model/message.model!DomainError} When there is no current project, the host does not know its platform or the template has no dev container.
   */
  public async addDevContainer(): Promise<void> {
    if (!(await this.deps.hostController.ensure())) return
    const project: Project = this.deps.projects.require()
    const result: WriteResult = await Dialogs.progress(t('WarpEngine: adding a dev container to {0}', project.title), async (report) =>
      this.deps.scaffold.addDevContainer({ project, host: this.deps.hosts.require().url, report }))
    const kept: string = result.skipped.length > 0 ? ` ${t('Kept your own: {0}.', result.skipped.join(', '))}` : ''
    const tasks: string = result.tasks.length > 0 ? ` ${t('Tasks added: {0}.', result.tasks.join(', '))}` : ''
    Dialogs.info(`${t('Added {0}.', result.written.join(', ') || '—')}${kept}${tasks} ${t('Its builds run in the dev container now.')}`)
  }

  /**
   * `warpengine.addToProject`: adds the marker, the metadata and the template's files to a workspace folder; the project's own files are kept.
   *
   * Asks for the host, the folder (when there are several), the platform and the answers; writes with a progress notification, re-reads the projects and offers to connect.
   */
  public async addToProject(): Promise<void> {
    if (!(await this.deps.hostController.ensure())) return
    const folder: vscode.WorkspaceFolder | undefined = await NewGameController.pickFolder()
    if (!folder) return
    const platform: Platform | null = await this.deps.dialog.platform(t('{0}: platform', folder.name))
    const answers: GameAnswers | null = platform ? await this.deps.dialog.answers(platform, folder.name) : null
    if (!platform || !answers) return
    const result: WriteResult = await Dialogs.progress(t('WarpEngine: adding {0} to {1}', platform.label, folder.name), async (report) =>
      this.deps.scaffold.write({ folder: folder.uri.fsPath, platform, answers, host: this.deps.hosts.require().url, withDemo: false, overwrite: false, report }))
    await this.deps.projects.refresh()
    await this.offerConnect(result)
  }

  private async askNewGame(): Promise<NewGame | null> {
    if (!(await this.deps.hostController.ensure())) return null
    const platform: Platform | null = await this.deps.dialog.platform(t('New game: platform'))
    const answers: GameAnswers | null = platform ? await this.deps.dialog.answers(platform, null) : null
    if (!platform || !answers) return null
    const parent: string | null = await FolderOpenDialog.askParent(answers.name, t('Create the project here'))
    if (!parent) return null
    const folder: string = FilePath.join(parent, answers.name)
    if (await this.deps.scaffold.exists(folder)) {
      Dialogs.error(t('{0} exists already.', folder))
      return null
    }
    return { platform, answers, folder, withDemo: await this.askDemo(platform) }
  }

  private async askDemo(platform: Platform): Promise<boolean> {
    if (!platform.demoUrl) return false
    const templateOnly: string = t('Start from the template only')
    const picked: string | undefined = await vscode.window.showQuickPick([t('Start from the demo game'), templateOnly], { title: t('Starting point') })
    return picked !== templateOnly
  }

  private async offerConnect(result: WriteResult): Promise<void> {
    const skipped: string = result.skipped.length > 0 ? ` ${t('Kept your own: {0}.', result.skipped.join(', '))}` : ''
    const connect: string = t('Connect')
    const answer: string | undefined = await Dialogs.ask(`${t('Added {0}.', result.written.join(', '))}${skipped}`, connect)
    const project: Project | null = this.deps.projects.current()
    if (answer === connect && project) await this.deps.connect.connectProject(project)
  }

  private static async pickFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders
    if (folders?.length === 1) return folders[0]
    return vscode.window.showWorkspaceFolderPick({ placeHolder: t('The project to add WarpEngine to') })
  }

  private async offerOpen(game: NewGame, result: WriteResult): Promise<void> {
    await this.deps.opener.offer({
      folder: game.folder, message: t('{0} is ready ({1} files). Open it to build, play and connect it.', game.answers.title, result.written.length),
      devContainer: result.written.includes(DevContainer.FILE), beforeOpen: async (): Promise<void> => { await this.deps.connect.offerLater(game.folder) }
    })
  }
}
