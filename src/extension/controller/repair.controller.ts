/**
 * Fix…: why the current host does not answer, and the step that puts it right — start Docker, start, restart,
 * reinstall or remove the local engine, or choose another host.
 *
 * @packageDocumentation
 */

import { homedir } from 'node:os'
import * as vscode from 'vscode'
import { Servers } from '../../domain/model/server.model'
import type { HostDiagnosis } from '../../domain/model/repair.model'
import type { DockerAvailability } from '../../domain/repository/container-runtime.repository'
import type { HostService } from '../../domain/service/host.service'
import type { RepairService } from '../../domain/service/repair.service'
import type { ServerService } from '../../domain/service/server.service'
import { Dialogs } from '../ui/dialogs'
import { HostMachineDialog } from '../ui/host-machine.dialog'
import { t } from '../ui/l10n'
import type { LocalEngineController } from './local-engine.controller'
import type { RefreshController } from './refresh.controller'
import type { ServersController } from './servers.controller'

const DOCKER_WAIT_MS = 90_000
const ENGINE_WAIT_MS = 90_000
const GET_DOCKER = 'https://docs.docker.com/get-started/get-docker/'
const SELECT_HOST = 'warpengine.selectHost'

/** What {@link RepairController} works with. */
export interface RepairDependencies {
  /** Finds why the host does not answer and waits for it. */
  readonly repair: RepairService
  /** Starts, restarts and lists the local containers, and Docker. */
  readonly servers: ServerService
  /** The configured hosts, to switch to the address the local engine answers at. */
  readonly hosts: HostService
  /** Runs the installer. */
  readonly localEngine: LocalEngineController
  /** Removes the local engine (Purge). */
  readonly purge: ServersController
  /** Redraws everything once the host answers. */
  readonly refresh: RefreshController
  /** Tells whether this window runs in a dev container, where Docker cannot be reached. */
  readonly inside: () => boolean
}

type Step = () => Promise<void>

interface Prompt {
  readonly message: string
  readonly detail: string
  readonly steps: [string, Step][]
}

/**
 * Serves `warpengine.repairHost` (*Fix…*, the remedy of every "cannot be reached"), `warpengine.startDocker` and
 * `warpengine.startLocalEngine`, and offers *Fix…* once per window when the local engine set as the host does not answer.
 */
export class RepairController {
  private offered: string | null = null

  /**
   * Creates the controller.
   *
   * @param deps - The services and controllers it uses.
   */
  public constructor(private readonly deps: RepairDependencies) {}

  /**
   * `warpengine.repairHost`: finds why the current host does not answer and asks, in a modal dialog, which step to
   * take; after the step it looks again, until the host answers or the dialog is cancelled. When it answers, everything is refreshed.
   */
  public async repair(): Promise<void> {
    const diagnosis: HostDiagnosis = await Dialogs.progress(t('Looking at the WarpEngine host…'), async (): Promise<HostDiagnosis> => this.deps.repair.diagnose())
    const step: Step | null = await this.ask(diagnosis)
    if (step) await step()
  }

  /**
   * Offers *Fix…* in a notification when the local engine set as the host does not answer: once per window and
   * address, or every time the installer has just closed.
   *
   * @param afterInstall - `true` when the installer has just closed.
   */
  public async offer(afterInstall: boolean): Promise<void> {
    const url: string = this.deps.hosts.current()?.url ?? ''
    if (!afterInstall && this.offered === url) return
    this.offered = url
    const text: string = afterInstall ? t('The local engine does not answer at {0} after the installer.', url) : t('The local engine at {0} does not answer.', url)
    const fix: string = t('Fix…')
    if ((await Dialogs.alert(text, fix)) === fix) await this.repair()
  }

  /**
   * `warpengine.startDocker`: opens OrbStack or Docker Desktop (macOS, Windows), or starts the Docker service in a
   * terminal (`sudo systemctl start docker`, Linux); waits for Docker, then refreshes and, for a local host, looks at it again.
   * Without a Docker command it offers to get Docker or set the command instead; in a dev container, to reopen the folder on the computer.
   */
  public async startDocker(): Promise<void> {
    if (!(await HostMachineDialog.allows(this.deps.inside()))) return
    const availability: DockerAvailability = await this.deps.servers.docker()
    if (availability === 'missing') {
      await this.dockerMissing()
      return
    }
    if (availability === 'down' && !(await this.deps.servers.launchDocker())) RepairController.startDockerService()
    const up: boolean = await Dialogs.progress(t('Waiting for Docker…'), async (): Promise<boolean> => this.deps.repair.waitForDocker(DOCKER_WAIT_MS))
    if (!up) {
      Dialogs.error(t('Docker does not answer yet; start it, then try again.'))
      return
    }
    await this.deps.refresh.refresh()
    if (this.deps.repair.isLocalHost() && !(await this.deps.repair.waitForHost(0))) await this.repair()
  }

  /**
   * `warpengine.startLocalEngine`: starts the stopped WarpEngine containers, waits for the host when it is the local
   * engine, then refreshes everything; in a dev container it offers to reopen the folder on the computer instead.
   */
  public async startLocalEngine(): Promise<void> {
    if (!(await HostMachineDialog.allows(this.deps.inside()))) return
    await this.afterStep(t('Starting the local engine…'), async (): Promise<void> => { await this.deps.servers.startLocal() })
  }

  private async ask(diagnosis: HostDiagnosis): Promise<Step | null> {
    if (diagnosis.kind === 'answers') return async (): Promise<void> => this.answers(diagnosis.url)
    if (diagnosis.kind === 'dockerMissing') return async (): Promise<void> => this.dockerMissing()
    const prompt: Prompt = diagnosis.kind === 'noHost' ? this.noHost() : this.prompt(diagnosis)
    return this.choose(prompt.message, prompt.detail, prompt.steps)
  }

  private prompt(diagnosis: Exclude<HostDiagnosis, { kind: 'answers' | 'dockerMissing' | 'noHost' }>): Prompt {
    switch (diagnosis.kind) {
      case 'remote': return this.remote(diagnosis.url)
      case 'inside': return { message: t('The local engine at {0} does not answer.', diagnosis.url), detail: t('This window runs in a dev container, where Docker cannot be reached: reopen the folder on the computer, where Fix… repairs the engine, or choose another host.'), steps: [[HostMachineDialog.label(), async (): Promise<void> => HostMachineDialog.reopen()], this.again(), this.otherHost()] }
      case 'dockerDown': return { message: t('Docker does not run.'), detail: t('The local engine runs in Docker.'), steps: [[t('Start Docker'), async (): Promise<void> => this.startDocker()], this.otherHost()] }
      case 'notInstalled': return this.notInstalled(diagnosis.dataFolder, diagnosis.configured)
      case 'stopped': return this.stopped(diagnosis.containers)
      case 'elsewhere': return { message: t('The local engine answers at {0}, not at the host set.', diagnosis.url), detail: t('Use that address as the host?'), steps: [[t('Use {0}', diagnosis.url), async (): Promise<void> => this.use(diagnosis.url)], this.otherHost()] }
      case 'notAnswering': return this.notAnswering(diagnosis.url)
    }
  }

  private noHost(): Prompt {
    return { message: t('No WarpEngine host is set.'), detail: t('Install one on this machine (Docker), or set the address of one.'), steps: [[t('Install a local engine'), this.install(false)], this.otherHost()] }
  }

  private remote(url: string): Prompt {
    const open: Step = async (): Promise<void> => Dialogs.openExternal(url)
    return { message: t('{0} does not answer.', url), detail: t('Check the address and the network, or choose another host.'), steps: [this.again(), [t('Open in Browser'), open], this.otherHost()] }
  }

  private notInstalled(dataFolder: string | null, configured: boolean): Prompt {
    const install: [string, Step] = configured ? [t('Reinstall'), this.install(true)] : [t('Install a local engine'), this.install(false)]
    const remove: [string, Step][] = dataFolder ? [[t('Remove Its Data…'), this.remove()]] : []
    const detail: string = dataFolder ? t('Its data is still in {0}: a reinstall keeps it, a removal deletes it.', dataFolder) : t('Install it, or choose another host.')
    return { message: t('The local engine is not installed.'), detail, steps: [install, ...remove, this.otherHost()] }
  }

  private stopped(containers: readonly string[]): Prompt {
    const start: Step = async (): Promise<void> => this.startLocalEngine()
    return { message: t('The local engine is stopped.'), detail: t('Not running: {0}', containers.join(', ')), steps: [[t('Start'), start], [t('Reinstall'), this.install(true)], [t('Remove…'), this.remove()], this.otherHost()] }
  }

  private notAnswering(url: string): Prompt {
    const restart: Step = async (): Promise<void> => this.restart()
    const log: Step = async (): Promise<void> => { RepairController.showLog(); return Promise.resolve() }
    return { message: t('The local engine runs but does not answer at {0}.', url), detail: t('It may still be starting; a restart or its log tells more.'), steps: [[t('Restart'), restart], [t('Show Log'), log], [t('Reinstall'), this.install(true)]] }
  }

  private async choose(message: string, detail: string, steps: [string, Step][]): Promise<Step | null> {
    const answer: string | undefined = await Dialogs.choose(message, detail, ...steps.map(([label]) => label))
    return steps.find(([label]) => label === answer)?.[1] ?? null
  }

  private otherHost(): [string, Step] {
    return [t('Set Host…'), async (): Promise<void> => { await vscode.commands.executeCommand(SELECT_HOST) }]
  }

  private again(): [string, Step] {
    return [t('Try Again'), async (): Promise<void> => this.repair()]
  }

  private remove(): Step {
    return async (): Promise<void> => this.deps.purge.purge()
  }

  private install(reuse: boolean): Step {
    return async (): Promise<void> => this.deps.localEngine.install(reuse)
  }

  private async dockerMissing(): Promise<void> {
    const get: string = t('Get Docker')
    const setting: string = t('Docker Command Setting')
    const answer: string | undefined = await Dialogs.choose(t('Docker is not installed.'), t('The local engine runs in Docker. Install it, or set warpengine.docker to the Docker command when it is somewhere else.'), get, setting)
    if (answer === get) await Dialogs.openExternal(GET_DOCKER)
    if (answer === setting) await vscode.commands.executeCommand('workbench.action.openSettings', 'warpengine.docker')
  }

  private async restart(): Promise<void> {
    await this.afterStep(t('Restarting the local engine…'), async (): Promise<void> => this.deps.servers.restartEngine())
  }

  private async use(url: string): Promise<void> {
    await this.deps.hosts.select(url)
    await this.deps.refresh.refresh()
  }

  private async answers(url: string): Promise<void> {
    await this.deps.refresh.refresh()
    Dialogs.info(t('{0} answers.', url))
  }

  private async afterStep(title: string, step: () => Promise<void>): Promise<void> {
    const local: boolean = this.deps.repair.isLocalHost()
    const up: boolean = await Dialogs.progress(title, async (): Promise<boolean> => {
      await step()
      return !local || this.deps.repair.waitForHost(ENGINE_WAIT_MS)
    })
    if (up) await this.deps.refresh.refresh()
    else await this.repair()
  }

  private static startDockerService(): void {
    if (process.platform !== 'linux') return
    vscode.window.createTerminal({ name: 'Docker', cwd: homedir(), shellPath: '/bin/sh', shellArgs: ['-c', `sudo systemctl start docker; printf '\\n%s ' '${t('Press Enter to close')}'; read _`] }).show()
  }

  private static showLog(): void {
    const docker: string = vscode.workspace.getConfiguration('warpengine').get<string>('docker') ?? 'docker'
    vscode.window.createTerminal({ name: t('WarpEngine Local log'), shellPath: docker, shellArgs: ['logs', '--tail', '200', '-f', Servers.ENGINE] }).show()
  }
}
