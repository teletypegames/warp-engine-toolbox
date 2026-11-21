/**
 * Reset…: the local engine with all its Docker parts and data, the projects' dev containers, and the toolbox itself
 * with its settings, removed from this computer — chosen parts or everything at once.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import type { DevContainerPlan, PurgePlan } from '../../domain/model/server.model'
import { Servers } from '../../domain/model/server.model'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import type { RepairService } from '../../domain/service/repair.service'
import type { ServerService } from '../../domain/service/server.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import { Dialogs, type PickItem, type Report } from '../ui/dialogs'
import { HostMachineDialog } from '../ui/host-machine.dialog'
import { t } from '../ui/l10n'
import type { ToolboxState } from '../workspace/toolbox.state'
import type { LocalEngineController } from './local-engine.controller'
import type { RefreshController } from './refresh.controller'

/** A part of a reset. */
type Part = 'everything' | 'local' | 'devContainers' | 'toolbox'

/** What {@link ResetController} works with. */
export interface ResetDependencies {
  /** The local containers, their purge and the dev containers. */
  readonly servers: ServerService
  /** Finds the installation's data folder. */
  readonly repair: RepairService
  /** Tells whether the local engine is the current host. */
  readonly local: LocalEngineService
  /** Signs out. */
  readonly auth: WarpEngineAuthProvider
  /** Looks for the local engine again after it is gone. */
  readonly localEngine: LocalEngineController
  /** Redraws everything after a reset that keeps the toolbox. */
  readonly refresh: RefreshController
  /** The toolbox's settings, sessions and state. */
  readonly state: ToolboxState
  /** The toolbox's extension id, to uninstall it. */
  readonly extensionId: string
  /** Tells whether this window runs in a dev container, where a reset must not run. */
  readonly inside: () => boolean
}

interface Plans {
  readonly local: PurgePlan | null
  readonly devContainers: DevContainerPlan | null
}

/** Serves `warpengine.reset` (also a button of the Dashboard). */
export class ResetController {
  /**
   * Creates the controller.
   *
   * @param deps - The services, the toolbox state and the controllers it uses.
   */
  public constructor(private readonly deps: ResetDependencies) {}

  /**
   * `warpengine.reset`: asks which parts to remove — everything, the local engine (containers, volumes, network,
   * images and its data folder), the projects' dev containers (with their images and volumes), the toolbox (its
   * settings, sign-ins and state, then the extension) — confirms with a list of what goes, and removes it under a
   * progress notification. In a dev container it offers to reopen the folder on the computer instead.
   */
  public async reset(): Promise<void> {
    if (!(await HostMachineDialog.allows(this.deps.inside()))) return
    const plans: Plans = await Dialogs.progress(t('Looking at what a reset removes…'), async () => this.plans())
    const parts: Part[] | null = await this.choose(plans)
    if (!parts || parts.length === 0) return
    if (!(await Dialogs.confirm(this.question(parts, plans), t('Reset')))) return
    await Dialogs.progress(t('Resetting WarpEngine'), async (report) => {
      if (parts.includes('devContainers') && plans.devContainers) await this.deps.servers.removeDevContainers(plans.devContainers, report)
      if (parts.includes('local') && plans.local) await this.removeLocal(plans.local, report)
    })
    if (parts.includes('toolbox')) {
      await this.removeToolbox()
      return
    }
    await this.deps.localEngine.discover().catch(() => null)
    await this.deps.refresh.refresh()
    Dialogs.info(t('Reset done.'))
  }

  private async plans(): Promise<Plans> {
    const local: PurgePlan | null = await this.deps.servers.purgePlan(await this.deps.repair.dataFolder()).catch((): null => null)
    const devContainers: DevContainerPlan | null = await this.deps.servers.devContainerPlan().catch((): null => null)
    return { local, devContainers }
  }

  private async choose(plans: Plans): Promise<Part[] | null> {
    const docker: string = t('Docker does not answer')
    const items: PickItem<Part>[] = [
      { label: t('Everything'), description: t('all of the below'), value: 'everything' },
      { label: t('Local engine'), description: plans.local ? ResetController.localSummary(plans.local) : docker, value: 'local' },
      { label: t('Dev containers'), description: plans.devContainers ? t('{0} containers, {1} images, {2} volumes', plans.devContainers.containers.length, plans.devContainers.images.length, plans.devContainers.volumes.length) : docker, value: 'devContainers' },
      { label: t('WarpEngine Toolbox'), description: t('{0} settings, the sign-ins and the stored state, then the extension', this.deps.state.setSettings()), value: 'toolbox' }
    ]
    const picked: Part[] | undefined = await Dialogs.pickMany(items, { title: t('Reset: what goes from this computer?'), ignoreFocusOut: true })
    if (!picked) return null
    return picked.includes('everything') ? ['devContainers', 'local', 'toolbox'] : picked
  }

  private question(parts: Part[], plans: Plans): string {
    const lines: string[] = []
    if (parts.includes('local')) lines.push(plans.local ? `${t('the local engine')}: ${ResetController.localSummary(plans.local)}` : t('the local engine: nothing, Docker does not answer'))
    if (parts.includes('devContainers')) lines.push(plans.devContainers ? t('{0} dev containers with their images and volumes (windows open in them close)', plans.devContainers.containers.length) : t('the dev containers: nothing, Docker does not answer'))
    if (parts.includes('toolbox')) lines.push(t('the WarpEngine Toolbox, its settings, sign-ins and stored state'))
    return t('Remove from this computer for good: {0}? This cannot be undone.', lines.join('; '))
  }

  private async removeLocal(plan: PurgePlan, report: Report): Promise<void> {
    const wasCurrent: boolean = this.deps.local.isCurrentHost()
    if (!Servers.isEmpty(plan)) await this.deps.servers.purge(plan, report)
    if (wasCurrent) await this.deps.auth.signOut()
  }

  private async removeToolbox(): Promise<void> {
    await this.deps.auth.signOutEverywhere()
    await this.deps.state.clear()
    await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', this.deps.extensionId)
    const reload: string = t('Reload Window')
    if ((await Dialogs.ask(t('The WarpEngine Toolbox and its settings are removed. Reload the window to finish.'), reload)) === reload) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow')
    }
  }

  private static localSummary(plan: PurgePlan): string {
    const data: string = plan.dataFolder ? `, ${plan.dataFolder}` : ''
    return `${t('{0} containers, {1} volumes, {2} images', plan.containers.length, plan.volumes.length, plan.images.length)}${data}`
  }
}
