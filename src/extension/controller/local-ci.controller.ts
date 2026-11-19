import * as vscode from 'vscode'
import type { LocalCiSetup, LocalComponent, LocalCredentials } from '../../domain/model/local-ci.model'
import type { Project } from '../../domain/model/project.model'
import type { LocalCiService } from '../../domain/service/local-ci.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { TreeNode } from '../view/tree/tree.node'
import type { TreeProvider } from '../view/tree/tree.provider'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

export interface LocalCiDependencies {
  readonly localCi: LocalCiService
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly tree: TreeProvider
}

type Action = 'enable' | 'disable' | 'remove' | 'purge'

export class LocalCiController {
  public constructor(private readonly deps: LocalCiDependencies) {}

  public async setUp(): Promise<void> {
    const project: Project = this.deps.projects.require()
    const setup: LocalCiSetup = await Dialogs.progress(t('Setting {0} up on the local CI', project.title), async (report) => this.deps.localCi.setUp(project, report))
    this.deps.tree.refresh()
    await this.deps.states.refresh()
    this.deps.states.watch()
    const warnings: string = setup.warnings.length > 0 ? ` ${setup.warnings.join('; ')}` : ''
    Dialogs.info(t('{0} builds on the local CI now: pushed to the "{1}" remote. Release… tags it there.{2}', project.title, setup.remoteName, warnings))
  }

  public async enable(node?: TreeNode): Promise<void> {
    await this.act('enable', node)
  }

  public async disable(node?: TreeNode): Promise<void> {
    await this.act('disable', node)
  }

  public async remove(node?: TreeNode): Promise<void> {
    const component: LocalComponent | undefined = node?.data as LocalComponent | undefined
    if (!component) return
    const keep: string = t('Remove, keep the data')
    const purge: string = t('Remove with its data')
    const answer: string | undefined = await vscode.window.showWarningMessage(t('Remove {0}? Without its data its repositories or build history are gone too.', component.label), { modal: true }, keep, purge)
    if (answer) await this.act(answer === purge ? 'purge' : 'remove', node)
  }

  public async open(node?: TreeNode): Promise<void> {
    const component: LocalComponent | undefined = node?.data as LocalComponent | undefined
    if (!component) return
    const credentials: LocalCredentials = await this.deps.localCi.credentials(component.key)
    await vscode.env.clipboard.writeText(credentials.password)
    Dialogs.info(t('Sign in as {0}; the password is on the clipboard.', credentials.user))
    await Dialogs.openExternal(credentials.url)
  }

  private async act(action: Action, node?: TreeNode): Promise<void> {
    const component: LocalComponent | undefined = node?.data as LocalComponent | undefined
    if (!component) return
    const titles: Record<Action, string> = { enable: t('Starting {0}', component.label), disable: t('Stopping {0}', component.label),
                                             remove: t('Removing {0}', component.label), purge: t('Removing {0}', component.label) }
    try {
      await Dialogs.progress(titles[action], async (report) => this.deps.localCi.run(action, component.key, report))
    } finally {
      this.deps.tree.refresh()
    }
  }
}
