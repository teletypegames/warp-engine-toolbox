/**
 * Read-only report documents: checklists, statistics and the pipeline preview.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'

/** The URI scheme of the report documents. */
export const REPORT_SCHEME = 'warpengine-report'

/** Holds generated text in memory and shows it as read-only documents under {@link REPORT_SCHEME}. */
export class ReportView implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents: Map<string, string> = new Map<string, string>()
  private readonly changed: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>()
  /** Fires when a report document changes, so an open editor or preview shows the new content. */
  public readonly onDidChange: vscode.Event<vscode.Uri> = this.changed.event
  private readonly registration: vscode.Disposable = vscode.workspace.registerTextDocumentContentProvider(REPORT_SCHEME, this)

  /**
   * Returns the content of a report document.
   *
   * @param uri - The report document URI.
   * @returns The content, or an empty text for an unknown report.
   */
  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.path) ?? ''
  }

  /**
   * Stores a report and opens it: as a Markdown preview, or as a text document in a preview editor.
   *
   * @param name - The document name, with its extension.
   * @param content - The text.
   * @param markdown - `true` for the Markdown preview, `false` for a text editor.
   */
  public async show(name: string, content: string, markdown: boolean = true): Promise<void> {
    const path = `/${name}`
    this.contents.set(path, content)
    const uri: vscode.Uri = vscode.Uri.from({ scheme: REPORT_SCHEME, path })
    this.changed.fire(uri)
    if (markdown) await vscode.commands.executeCommand('markdown.showPreview', uri)
    else await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri), { preview: true })
  }

  /** Unregisters the content provider and its event. */
  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
  }
}
