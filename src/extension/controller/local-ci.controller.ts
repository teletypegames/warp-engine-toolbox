/**
 * Setting a project up on the local engine's git server and CI.
 *
 * @packageDocumentation
 */

import type * as vscode from 'vscode'
import type { LocalCiSetup } from '../../domain/model/local-ci.model'
import type { Project } from '../../domain/model/project.model'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { LocalCiService } from '../../domain/service/local-ci.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import { Remedies } from '../ui/remedies'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

/** What {@link LocalCiController} works with. */
export interface LocalCiDependencies {
  /** Sets a project up on the local CI. */
  readonly localCi: LocalCiService
  /** The workspace state that remembers the projects the user declined the offer for. */
  readonly memory: vscode.Memento
  /** The current project. */
  readonly projects: ProjectRegistry
  /** The remote state, refreshed and polled after the setup. */
  readonly states: RemoteStateStore
  /** The project view, redrawn after the setup. */
  readonly tree: TreeProvider
}

const DECLINED_KEY = 'warpengine.localCiDeclined'

/** Serves `warpengine.setupLocalCi` and offers the setup when a project could build on the local CI. */
export class LocalCiController {
  private readonly offered: Set<string> = new Set<string>()

  /**
   * Creates the controller.
   *
   * @param deps - The service, the stores and the view it uses.
   */
  public constructor(private readonly deps: LocalCiDependencies) {}

  /**
   * Offers, once per project and window, to set a project up on the local CI, when the local engine runs one and the project is not on it yet.
   *
   * *Not for this project* is remembered in the workspace state; *Set up* runs {@link LocalCiController.setUp}, and a failure is shown as an error notification.
   *
   * @param state - The remote state of the current project; `null` offers nothing.
   */
  public async offer(state: RemoteState | null): Promise<void> {
    if (!state || !(await this.deps.localCi.offerable(state, [...this.offered, ...this.declined()]))) return
    const name: string = state.project.name
    this.offered.add(name)
    const setUp: string = t('Set up')
    const never: string = t('Not for this project')
    const answer: string | undefined = await Dialogs.ask(t('The local CI runs on this machine. Set {0} up on it: a repository on the local git server, built on every push?', state.project.title), setUp, never)
    if (answer === never) await this.deps.memory.update(DECLINED_KEY, [...this.declined(), name])
    if (answer !== setUp) return
    await this.setUp().catch(async (error: unknown) => { await Remedies.report(error) })
  }

  /**
   * `warpengine.setupLocalCi`: creates the repository on the local git server, activates it in the local CI and pushes the project to a `wplocal` remote, with a progress notification.
   *
   * Redraws the project view, refreshes and polls the remote state, and reports the remote (and any warnings) in a notification.
   *
   * @throws {@link "domain/model/message.model".DomainError} When there is no current project or the local engine refuses the setup.
   */
  public async setUp(): Promise<void> {
    const project: Project = this.deps.projects.require()
    const setup: LocalCiSetup = await Dialogs.progress(t('Setting {0} up on the local CI', project.title), async (report) => this.deps.localCi.setUp(project, report))
    this.deps.tree.refresh()
    await this.deps.states.refresh()
    this.deps.states.watch()
    const warnings: string = setup.warnings.length > 0 ? ` ${setup.warnings.join('; ')}` : ''
    Dialogs.info(t('{0} builds on the local CI now: pushed to the "{1}" remote. Release… can tag it there.{2}', project.title, setup.remoteName, warnings))
  }

  private declined(): string[] {
    return this.deps.memory.get<string[]>(DECLINED_KEY) ?? []
  }
}
