import * as vscode from 'vscode'

export const REPORT_SCHEME = 'warpengine-report'

export class Reports implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly contents = new Map<string, string>()
  private readonly changed: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>()
  public readonly onDidChange: vscode.Event<vscode.Uri> = this.changed.event
  private readonly registration: vscode.Disposable = vscode.workspace.registerTextDocumentContentProvider(REPORT_SCHEME, this)

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.path) ?? ''
  }

  public async show(name: string, content: string, markdown: boolean = true): Promise<void> {
    const path = `/${name}`
    this.contents.set(path, content)
    const uri: vscode.Uri = vscode.Uri.from({ scheme: REPORT_SCHEME, path })
    this.changed.fire(uri)
    if (markdown) {
      await vscode.commands.executeCommand('markdown.showPreview', uri)
    } else {
      const document: vscode.TextDocument = await vscode.workspace.openTextDocument(uri)
      await vscode.window.showTextDocument(document, { preview: true })
    }
  }

  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
  }
}
