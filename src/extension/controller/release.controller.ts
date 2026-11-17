import { Version } from '../../domain/model/version.model'
import type { Project } from '../../domain/model/project.model'
import type { PublishProblem } from '../../domain/model/publish-check.model'
import type { Readiness, ReleaseKind, ReleaseService } from '../../domain/service/release.service'
import { Dialogs, type PickItem } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { ProjectRegistry } from '../workspace/project.registry'
import type { RemoteStateStore } from '../workspace/remote-state.store'

const ANOTHER: string | null = null

export class ReleaseController {
  public constructor(private readonly service: ReleaseService, private readonly projects: ProjectRegistry, private readonly states: RemoteStateStore) {}

  public async run(): Promise<void> {
    const project: Project = this.projects.require()
    if (!(await this.ready(project))) return
    const version: string | null = await this.askVersion(project)
    if (!version || !(await this.verified(project, version))) return
    await Dialogs.progress(t('WarpEngine: releasing {0} {1}', project.name, version), async (report) => { await this.service.release({ project, version, report }) })
    this.states.watch()
    Dialogs.info(t('v{0} is pushed; the pipeline builds and publishes it. Its state shows in the status bar.', version))
  }

  private async ready(project: Project): Promise<boolean> {
    let readiness: Readiness = await this.service.readiness(project)
    if (readiness === 'dirty') {
      if (!(await Dialogs.confirm(t('The working copy has changes.'), t('Commit everything first')))) return false
      await this.service.commitWork(project)
      readiness = await this.service.readiness(project)
    }
    if (readiness === 'unconnected') Dialogs.error(t('Connect the project first: a release is a tag the CI builds.'))
    if (readiness === 'unwritable') Dialogs.error(t('This platform reads its version in a way the toolbox cannot write; bump it by hand and push a vX.Y.Z tag.'))
    return readiness === 'ready'
  }

  private async askVersion(project: Project): Promise<string | null> {
    const current: string = await this.service.currentVersion(project)
    const kind: ReleaseKind | undefined = await this.askKind(project, current)
    if (!kind) return null
    const candidates: string[] = this.service.candidates(current, kind)
    const items: PickItem<string | null>[] = [...candidates.map((label: string) => ({ label, value: label })), { label: t('Another version…'), value: ANOTHER }]
    const label: string = kind === 'beta' ? t('beta') : t('stable')
    const picked: string | null | undefined = await Dialogs.pick(items, { title: t('Release {0}: {1} version', project.name, label) })
    if (picked === undefined) return null
    const version: string | undefined = picked ?? await this.askCustom(candidates[0] ?? '1.0.0')
    return version ? version.replace(/^v/, '') : null
  }

  private async askKind(project: Project, current: string): Promise<ReleaseKind | undefined> {
    return Dialogs.pick<ReleaseKind>([
      { label: t('Stable'), description: t('everyone gets it: the catalog, the client, the store outlets'), value: 'stable' },
      { label: t('Beta'), description: t('a pre-release (1.3.0-beta.1): listed, offered only to those who ask for beta'), value: 'beta' }
    ], { title: t('Release {0} (now {1}): channel', project.name, current) })
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
    Dialogs.error(t('The publish would fail: {0}', errors.map((problem: PublishProblem) => `${problem.field}: ${problem.message}`).join('; ')))
    return false
  }
}
