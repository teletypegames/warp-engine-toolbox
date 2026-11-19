import type * as vscode from 'vscode'
import type { LocalCiSetup } from '../../domain/model/local-ci.model'
import type { Project } from '../../domain/model/project.model'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { LocalCiService } from '../../domain/service/local-ci.service'
import { Dialogs } from '../ui/dialogs'
import { errorText, t } from '../ui/l10n'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

export interface LocalCiDependencies {
  readonly localCi: LocalCiService
  readonly memory: vscode.Memento
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly tree: TreeProvider
}

const DECLINED_KEY = 'warpengine.localCiDeclined'

export class LocalCiController {
  private readonly offered: Set<string> = new Set<string>()

  public constructor(private readonly deps: LocalCiDependencies) {}

  public async offer(state: RemoteState | null): Promise<void> {
    if (!state || !(await this.deps.localCi.offerable(state, [...this.offered, ...this.declined()]))) return
    const name: string = state.project.name
    this.offered.add(name)
    const setUp: string = t('Set up')
    const never: string = t('Not for this project')
    const answer: string | undefined = await Dialogs.ask(t('The local CI runs on this machine. Set {0} up on it: a repository on the local git server, built on every push?', state.project.title), setUp, never)
    if (answer === never) await this.deps.memory.update(DECLINED_KEY, [...this.declined(), name])
    if (answer !== setUp) return
    await this.setUp().catch((error: unknown) => { Dialogs.error(errorText(error)) })
  }

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
