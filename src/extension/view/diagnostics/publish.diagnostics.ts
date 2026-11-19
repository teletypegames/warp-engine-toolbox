/**
 * The publish check of the metadata as diagnostics in the Problems view.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { LuaHeader, type HeaderLine } from '../../../domain/model/lua-header.model'
import type { Project } from '../../../domain/model/project.model'
import type { PublishCheck, PublishProblem } from '../../../domain/model/publish-check.model'
import type { HostService } from '../../../domain/service/host.service'
import type { PublishCheckService } from '../../../domain/service/publish-check.service'
import { Dialogs } from '../../ui/dialogs'
import { errorText, t } from '../../ui/l10n'
import type { ProjectRegistry } from '../../workspace/project.registry'

/**
 * Shows what the host would refuse on a publish as diagnostics on the metadata file (`metadata.json` or the TIC-80 Lua header), checked on every save while `warpengine.checkOnSave` is on.
 */
export class PublishDiagnostics implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('warpengine')
  private readonly subscription: vscode.Disposable

  /**
   * Creates the diagnostic collection and starts listening to document saves.
   *
   * @param hosts - The current host; without one nothing is checked.
   * @param projects - Finds the project a saved metadata file belongs to.
   * @param service - Asks the host for the publish check.
   */
  public constructor(
    private readonly hosts: HostService,
    private readonly projects: ProjectRegistry,
    private readonly service: PublishCheckService
  ) {
    this.subscription = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => { this.onSave(document) })
  }

  /**
   * Checks a project's metadata against the host and puts the problems on the file as errors and warnings.
   *
   * @param project - The project; without a metadata file or a known platform nothing is checked.
   * @param report - When `true`, a missing host and a failed check are shown as errors, and the result is announced: a notification when nothing is wrong, the Problems view otherwise.
   * @returns The check, or `null` when nothing was checked or the check failed.
   * @throws {@link "domain/model/message.model".DomainError} With `report`, when no host is set.
   */
  public async check(project: Project, report: boolean): Promise<PublishCheck | null> {
    if (!project.metadataPath || !project.platform) return null
    if (!this.hosts.current()) {
      if (report) this.hosts.require()
      return null
    }
    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(project.metadataPath))
    const result: PublishCheck | null = await this.service.check(project, document.getText()).catch((error: unknown) => {
      if (report) Dialogs.error(`${t('WarpEngine check')}: ${errorText(error)}`)
      return null
    })
    if (!result) return null
    this.collection.set(document.uri, result.problems.map((problem: PublishProblem) => PublishDiagnostics.diagnostic(document, project, problem)))
    if (report) await PublishDiagnostics.announce(result)
    return result
  }

  /** Stops listening to saves and clears the diagnostics. */
  public dispose(): void {
    this.subscription.dispose()
    this.collection.dispose()
  }

  private onSave(document: vscode.TextDocument): void {
    if (!vscode.workspace.getConfiguration('warpengine').get<boolean>('checkOnSave', true)) return
    const project: Project | null = this.projects.byMetadata(document.uri)
    if (project) void this.check(project, false)
  }

  private static async announce(result: PublishCheck): Promise<void> {
    if (result.problems.length === 0) Dialogs.info(t('WarpEngine: a publish would take this metadata as it is.'))
    else await vscode.commands.executeCommand('workbench.actions.view.problems')
  }

  private static diagnostic(document: vscode.TextDocument, project: Project, problem: PublishProblem): vscode.Diagnostic {
    const severity: vscode.DiagnosticSeverity = problem.level === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
    const item: vscode.Diagnostic = new vscode.Diagnostic(PublishDiagnostics.locate(document, project, problem.field), problem.message, severity)
    item.source = 'WarpEngine'
    item.code = problem.field
    return item
  }

  private static locate(document: vscode.TextDocument, project: Project, field: string): vscode.Range {
    const text: string = document.getText()
    if (project.metadataFormat === 'lua') {
      const line: HeaderLine | null = LuaHeader.parse(text).line(field)
      return document.lineAt(line?.line ?? 0).range
    }
    const index: number = text.indexOf(`"${field}"`)
    if (index < 0) return new vscode.Range(0, 0, 0, 1)
    return new vscode.Range(document.positionAt(index), document.positionAt(index + field.length + 2))
  }
}
