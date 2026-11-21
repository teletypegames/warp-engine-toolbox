/**
 * Fork…: a software of the catalog made into the user's own version, connected on a host they can connect to.
 *
 * @packageDocumentation
 */

import type { Software } from '../../domain/model/catalog.model'
import { Forks, type PublicSoftware } from '../../domain/model/fork.model'
import type { Project } from '../../domain/model/project.model'
import type { CloneService } from '../../domain/service/clone.service'
import type { ForkService, ForkTarget } from '../../domain/service/fork.service'
import type { HostService } from '../../domain/service/host.service'
import { Dialogs } from '../ui/dialogs'
import { FolderOpenDialog } from '../ui/folder-open.dialog'
import { ForkDialog, type ForkAnswers } from '../ui/fork.dialog'
import { t } from '../ui/l10n'
import { RemedyDialog } from '../ui/remedy.dialog'
import type { TreeNode } from '../view/tree/tree.node'
import { CloneController } from './clone.controller'
import type { ConnectController } from './connect.controller'

/** What {@link ForkController} works with. */
export interface ForkControllerDependencies {
  /** Makes the fork. */
  readonly forks: ForkService
  /** Reads the original from the public catalog. */
  readonly clone: CloneService
  /** Asks for the target, name and title. */
  readonly dialog: ForkDialog
  /** Remembers the flow for *Try Again…*. */
  readonly retry: CloneController
  /** Connects the fork. */
  readonly connect: ConnectController
  /** Makes the target host the current one before Connect. */
  readonly hosts: HostService
  /** Offers to open the fork. */
  readonly opener: FolderOpenDialog
}

/** Serves `warpengine.forkSoftware`. */
export class ForkController {
  /**
   * Creates the controller.
   *
   * @param deps - The services, dialogs and controllers it uses.
   */
  public constructor(private readonly deps: ForkControllerDependencies) {}

  /**
   * `warpengine.forkSoftware`: reads the software from the public catalog, shows its owner and licence, asks for the
   * target host, the name, the title and the parent folder, and makes the fork with a progress notification (clone,
   * `origin` renamed to `upstream`, metadata, commit). Then asks for a licence when the original has none, makes the
   * target the current host and runs Connect on the fork; last, offers to open its folder.
   *
   * @param node - The software node of the Catalog view.
   * @throws {@link "domain/model/message.model".DomainError} When the software cannot be forked, no host can take it, or the fork fails.
   */
  public async fork(node?: TreeNode): Promise<void> {
    const software: Software | null = CloneController.softwareOf(node)
    if (!software) return
    this.deps.retry.remember(async (): Promise<void> => { await this.fork(node) })
    const engine: string = this.deps.clone.engineUrl()
    const original: PublicSoftware = await this.deps.clone.software(software.name)
    this.deps.forks.check(original)
    if (!(await ForkDialog.confirm(original, engine))) return
    const answers: ForkAnswers | null = await this.deps.dialog.ask(original)
    const parent: string | null = answers ? await FolderOpenDialog.askParent(answers.name, t('Fork here')) : null
    if (!answers || !parent) return
    const project: Project = await Dialogs.progress(t('WarpEngine: forking {0}', original.title), async (report) =>
      this.deps.forks.fork({ original, engine, name: answers.name, title: answers.title, parent, report }))
    await this.connect(project, answers.target, original)
    await this.deps.opener.offer({
      folder: project.folder, message: t('{0} is your fork of {1}.', answers.title, original.title), devContainer: await this.deps.clone.hasDevContainer(project.folder)
    })
  }

  private async connect(project: Project, target: ForkTarget, original: PublicSoftware): Promise<void> {
    try {
      const license: string | null = Forks.needsLicense(original) ? await ForkDialog.license() : null
      if (license) await this.deps.forks.setLicense(project, license)
      if (this.deps.hosts.current()?.url !== target.host.url) await this.deps.hosts.select(target.host.url)
      await this.deps.connect.connectProject(await this.deps.forks.project(project.folder))
    } catch (error: unknown) {
      await RemedyDialog.report(error)
    }
  }
}
