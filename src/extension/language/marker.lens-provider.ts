import * as vscode from 'vscode'
import { t } from '../ui/l10n'

export class MarkerLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const line: number = document.getText().split(/\r?\n/).findIndex((text: string) => text.startsWith('platform:'))
    if (line < 0) return []
    return [new vscode.CodeLens(document.lineAt(line).range, { title: t('Preview the pipeline WarpEngine serves'), command: 'warpengine.previewPipeline' })]
  }
}
