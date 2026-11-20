/**
 * The Health view: what is set up and what is not, with the step that fixes each gap.
 *
 * @packageDocumentation
 */

import type * as vscode from 'vscode'
import { HealthChecks, type HealthCheck, type HealthSection, type HealthStatus } from '../../../domain/model/health.model'
import type { HealthService } from '../../../domain/service/health.service'
import { t, translate } from '../../ui/l10n'
import { RemedyDialog } from '../../ui/remedy.dialog'
import type { ProjectRegistry } from '../../workspace/project.registry'
import type { RemoteStateStore } from '../../workspace/remote-state.store'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

const LOOK: Readonly<Record<HealthStatus, { readonly icon: string; readonly color: string }>> = {
  ok: { icon: 'pass-filled', color: 'testing.iconPassed' },
  info: { icon: 'info', color: 'notificationsInfoIcon.foreground' },
  warning: { icon: 'warning', color: 'problemsWarningIcon.foreground' },
  error: { icon: 'error', color: 'problemsErrorIcon.foreground' }
}

/**
 * The content of the Health view (`warpengine.health`): the host, the local engine and the current project, each a
 * group of checks with a green, blue, yellow or red mark; a click on a check runs the step that fixes it (sign in,
 * install, connect, edit the metadata…) or opens the page that tells more.
 */
export class HealthTreeView implements TreeView {
  /**
   * Creates the view.
   *
   * @param health - Runs the checks.
   * @param projects - The current project.
   * @param states - The current project's remote state.
   */
  public constructor(private readonly health: HealthService, private readonly projects: ProjectRegistry, private readonly states: RemoteStateStore) {}

  /**
   * Runs the checks (HTTP to the host, Docker, the publish check) and returns one collapsed node per group; its mark and count tell how the group stands.
   *
   * @returns The group nodes.
   */
  public async roots(): Promise<TreeNode[]> {
    const sections: HealthSection[] = await this.health.sections(this.projects.current(), this.states.current())
    return sections.map((section: HealthSection) => HealthTreeView.sectionNode(section))
  }

  private static sectionNode(section: HealthSection): TreeNode {
    const worst: HealthStatus = HealthChecks.worst(section.checks)
    const gaps: number = section.checks.filter((check: HealthCheck) => check.status === 'warning' || check.status === 'error').length
    return new TreeNode(translate(section.title), {
      ...LOOK[worst], description: gaps > 0 ? t('{0} to fix', gaps) : t('all good'), expanded: false,
      load: (): TreeNode[] => section.checks.map((check: HealthCheck) => HealthTreeView.checkNode(check))
    })
  }

  private static checkNode(check: HealthCheck): TreeNode {
    const detail: string = check.detail ? translate(check.detail) : ''
    const fix: string = check.remedy ? `→ ${RemedyDialog.label(check.remedy)}` : ''
    const command: vscode.Command | undefined = HealthTreeView.command(check)
    return new TreeNode(translate(check.title), {
      ...LOOK[check.status], description: [fix, detail].filter(Boolean).join(' · '),
      tooltip: [translate(check.title), detail, HealthTreeView.hint(check)].filter(Boolean).join('\n'),
      ...(command ? { command } : {}), ...(check.url && !check.remedy ? { context: 'link' } : {})
    })
  }

  private static command(check: HealthCheck): vscode.Command | undefined {
    if (check.remedy) return RemedyDialog.command(check.remedy)
    return check.url ? TreeNode.openUrl(check.url) : undefined
  }

  private static hint(check: HealthCheck): string {
    if (check.remedy) return t('Click: {0}', RemedyDialog.label(check.remedy))
    return check.url ?? ''
  }
}
