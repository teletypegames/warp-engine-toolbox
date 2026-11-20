/**
 * Release…: version, changelog, tag and push of the current project.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import type { Remedy } from '../../domain/model/message.model'
import { GitRemotes, type GitRemote } from '../../domain/model/git-remote.model'
import { Version } from '../../domain/model/version.model'
import type { Project } from '../../domain/model/project.model'
import type { PublishProblem } from '../../domain/model/publish-check.model'
import type { LocalEngineService } from '../../domain/service/local-engine.service'
import type { Readiness, ReleaseService } from '../../domain/service/release.service'
import { Dialogs, type PickItem } from '../ui/dialogs'
import { t } from '../ui/l10n'
import { RemedyDialog } from '../ui/remedy.dialog'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

const ANOTHER: string | null = null

/** Serves `warpengine.release`. */
export class ReleaseController {
  /**
   * Creates the controller.
   *
   * @param service - Decides and performs the release.
   * @param projects - The current project.
   * @param states - The remote state, polled after the push.
   * @param local - Tells whether the current host is the local engine, for the setup a release needs first.
   */
  public constructor(private readonly service: ReleaseService, private readonly projects: ProjectRegistry, private readonly states: RemoteStateStore, private readonly local: LocalEngineService) {}

  /**
   * `warpengine.release`: releases the current project.
   *
   * Checks readiness (offers Connect, or Set up local CI on the local engine, when the project has no remote; offers to commit a dirty working copy; shows an error when its version cannot be written), asks for the version in one list (the stable bumps, the beta pre-releases, or another), asks the host whether a publish would take it (when not, puts the problems in the Problems view and offers the metadata form), asks for the git remote when there are several, then writes the version and the changelog, commits, tags and pushes with a progress notification. Polls the remote state so the status bar follows the pipeline.
   *
   * @throws {@link "domain/model/message.model".DomainError} When there is no current project or a git step fails.
   */
  public async run(): Promise<void> {
    const project: Project = this.projects.require()
    if (!(await this.ready(project))) return
    const version: string | null = await this.askVersion(project)
    if (!version || !(await this.verified(project, version))) return
    const remote: string | undefined = await this.askRemote(project, version)
    if (!remote) return
    await Dialogs.progress(t('WarpEngine: releasing {0} {1}', project.name, version), async (report) => { await this.service.release({ project, version, remote, report }) })
    this.states.watch()
    Dialogs.info(t('v{0} is pushed; the pipeline builds and publishes it. Its state shows in the status bar.', version))
  }

  private async ready(project: Project): Promise<boolean> {
    let readiness: Readiness = await this.service.readiness(project)
    if (readiness === 'unconnected') readiness = await this.connectFirst(project)
    if (readiness === 'dirty') {
      if (!(await Dialogs.confirm(t('The working copy has changes.'), t('Commit everything first')))) return false
      await this.service.commitWork(project)
      readiness = await this.service.readiness(project)
    }
    if (readiness === 'unwritable') Dialogs.error(t('This platform reads its version in a way the toolbox cannot write; bump it by hand and push a vX.Y.Z tag.'))
    return readiness === 'ready'
  }

  private async connectFirst(project: Project): Promise<Readiness> {
    const remedy: Remedy = this.local.setupRemedy()
    const action: string = RemedyDialog.label(remedy)
    const message: string = remedy === 'setupLocalCi' ? t('A release is a tag the CI builds: set the project up on the local CI first.') : t('A release is a tag the CI builds: connect the project first.')
    if ((await Dialogs.alert(message, action)) !== action) return 'unconnected'
    await vscode.commands.executeCommand(RemedyDialog.command(remedy).command)
    return this.service.readiness(project)
  }

  private async askVersion(project: Project): Promise<string | null> {
    const current: string = await this.service.currentVersion(project)
    const stable: string[] = this.service.candidates(current, 'stable')
    const beta: string[] = this.service.candidates(current, 'beta')
    const items: PickItem<string | null>[] = [
      ReleaseController.separator(t('Stable: everyone gets it')),
      ...stable.map((label: string) => ({ label, value: label })),
      ReleaseController.separator(t('Beta: offered only to those who ask for beta')),
      ...beta.map((label: string) => ({ label, value: label })),
      ReleaseController.separator(''),
      { label: t('Another version…'), value: ANOTHER }
    ]
    const picked: string | null | undefined = await Dialogs.pick(items, { title: t('Release {0} (now {1})', project.name, current), placeHolder: t('The version to release') })
    if (picked === undefined) return null
    const version: string | undefined = picked ?? await this.askCustom(stable[0] ?? '1.0.0')
    return version ? new Version(version).text : null
  }

  private static separator(label: string): PickItem<string | null> {
    return { label, kind: vscode.QuickPickItemKind.Separator, value: ANOTHER }
  }

  private async askRemote(project: Project, version: string): Promise<string | undefined> {
    const remotes: GitRemote[] = await this.service.remotes(project)
    if (remotes.length === 1) return remotes[0]?.name
    return Dialogs.pick(remotes.map((remote: GitRemote) => ({ label: remote.name, description: GitRemotes.display(remote.url), value: remote.name })),
                        { title: t('Release {0} {1} to', project.name, version), placeHolder: t('The git remote whose CI builds and publishes the tag') })
  }

  private async askCustom(value: string): Promise<string | undefined> {
    return Dialogs.input({
      title: t('Version'), value,
      validateInput: (text: string) => Version.isReleaseFormat(text) ? null : t('MAJOR.MINOR.PATCH, with -beta.N for a pre-release')
    })
  }

  private async verified(project: Project, version: string): Promise<boolean> {
    const errors: PublishProblem[] = await this.service.verify(project, version)
    if (errors.length === 0) return true
    await vscode.commands.executeCommand('warpengine.checkPublish')
    const edit: string = RemedyDialog.label('editMetadata')
    const answer: string | undefined = await Dialogs.alert(t('The publish would fail: {0}', errors.map((problem: PublishProblem) => `${problem.field}: ${problem.message}`).join('; ')), edit)
    if (answer === edit) await vscode.commands.executeCommand('warpengine.editMetadata')
    return false
  }
}
