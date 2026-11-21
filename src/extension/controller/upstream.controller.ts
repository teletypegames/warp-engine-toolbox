/**
 * Pull from Upstream: a fork brought up to date with the software it was forked from.
 *
 * @packageDocumentation
 */

import type { Project } from '../../domain/model/project.model'
import type { PullResult, UpstreamService } from '../../domain/service/upstream.service'
import { Dialogs } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { ProjectRegistry } from '../workspace/project.registry'

/** Serves `warpengine.pullUpstream`. */
export class UpstreamController {
  /**
   * Creates the controller.
   *
   * @param service - Fetches and merges the upstream.
   * @param projects - Gives the current project.
   */
  public constructor(private readonly service: UpstreamService, private readonly projects: ProjectRegistry) {}

  /**
   * `warpengine.pullUpstream`: fetches the current project's `upstream` remote and merges its default branch, with a
   * progress notification; says whether anything came, and on conflicts names the files and leaves them to the
   * editor's merge view.
   *
   * @throws {@link "domain/model/message.model".DomainError} When there is no current project or no upstream, the working copy has changes or the fetch fails.
   */
  public async pull(): Promise<void> {
    const project: Project = this.projects.require()
    const result: PullResult = await Dialogs.progress(t('WarpEngine: pulling {0} from upstream', project.title), async (report) => this.service.pull(project, report))
    if (result.state === 'conflict') {
      Dialogs.error(t('Merging {0} stopped on conflicts in {1}. Resolve them in the merge view, then commit.', result.ref, result.conflicts.join(', ')))
      return
    }
    Dialogs.info(result.state === 'merged' ? t('{0} is merged into {1}.', result.ref, project.title) : t('{0} has nothing new from {1}.', project.title, result.ref))
  }
}
