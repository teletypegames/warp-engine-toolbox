/**
 * The code lens on the marker's `platform:` line.
 *
 * @module
 */
import * as vscode from 'vscode'
import { t } from '../ui/l10n'

/** Puts a *Preview the pipeline WarpEngine serves* lens on the `platform:` line of a pipeline file. */
export class MarkerLensProvider implements vscode.CodeLensProvider {
  /**
   * Provides one lens on the first line that starts with `platform:`, running `warpengine.previewPipeline`.
   *
   * @param document - The pipeline file.
   * @returns The lens, or none when the file has no `platform:` line.
   */
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const line: number = document.getText().split(/\r?\n/).findIndex((text: string) => text.startsWith('platform:'))
    if (line < 0) return []
    return [new vscode.CodeLens(document.lineAt(line).range, { title: t('Preview the pipeline WarpEngine serves'), command: 'warpengine.previewPipeline' })]
  }
}
