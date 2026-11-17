import type { ScaffoldResult } from '../../domain/model/catalog.model'
import { msg } from '../../domain/model/message.model'
import type { Project } from '../../domain/model/project.model'
import type { ConnectService, RemoteOption } from '../../domain/service/connect.service'
import { Dialogs, type PickItem } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

export class ConnectController {
  public constructor(private readonly service: ConnectService, private readonly projects: ProjectRegistry, private readonly states: RemoteStateStore) {}

  public async connect(): Promise<void> {
    await this.connectProject(this.projects.require())
    this.states.watch()
  }

  public async connectProject(project: Project): Promise<void> {
    if (!(await this.service.signIn())) return
    if (!(await this.confirmRemote(project))) return
    const result: ScaffoldResult = await Dialogs.progress(t('WarpEngine: connecting {0}', project.name), async (report) => {
      report(msg('creating the repository, CI and the catalog entry…'))
      const scaffold: ScaffoldResult = await this.service.scaffold(project)
      await this.service.attach({ project, scaffold, remote: await this.chooseRemote(scaffold), report })
      return scaffold
    })
    await this.projects.refresh()
    const warnings: string = result.warnings.length > 0 ? ` ${t('Warnings: {0}', result.warnings.join('; '))}` : ''
    Dialogs.info(`${t('{0} is on WarpEngine: {1}.', project.name, result.repository.htmlUrl ?? result.repository.name)}${warnings}`)
  }

  private async confirmRemote(project: Project): Promise<boolean> {
    const remote: string | null = await this.service.existingRemote(project)
    if (!remote) return true
    return Dialogs.confirm(t('This repository already has a remote ({0}). Connecting creates a new repository and points origin at it.', remote), t('Connect anyway'))
  }

  private async chooseRemote(scaffold: ScaffoldResult): Promise<string | null> {
    const options: RemoteOption[] = this.service.remoteOptions(scaffold)
    if (options.length <= 1) return options[0]?.url ?? null
    const items: PickItem<string>[] = options.map((option: RemoteOption) => ({ label: option.label, description: option.url, value: option.url }))
    return (await Dialogs.pick(items, { title: t('Push to the new repository over'), ignoreFocusOut: true })) ?? options[0]?.url ?? null
  }
}
