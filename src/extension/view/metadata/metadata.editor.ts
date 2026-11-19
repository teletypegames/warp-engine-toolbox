/**
 * The metadata form: `metadata.json` edited in a webview form built from the host's schema.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { MetadataDocument } from '../../../domain/model/metadata-document.model'
import type { Project } from '../../../domain/model/project.model'
import type { MetadataSchemaProvider } from '../../language/metadata-schema.provider'
import { Dialogs } from '../../ui/dialogs'
import { errorText, t } from '../../ui/l10n'
import type { ProjectRegistry } from '../../workspace/project.registry'
import { WebviewHtml } from '../webview.html'

/** The view type of the metadata form custom editor. */
export const METADATA_VIEW = 'warpengine.metadata'

interface FieldMessage {
  readonly type: 'set'
  readonly path: readonly string[]
  readonly value: unknown
}

type FormMessage = FieldMessage | { readonly type: 'ready' } | { readonly type: 'source' }

/**
 * The custom text editor that shows `metadata.json` as a form built from the platform's JSON schema; every change in the form is written into the document.
 */
export class MetadataEditor implements vscode.CustomTextEditorProvider {
  private readonly assets: vscode.Uri

  /**
   * Creates the editor provider.
   *
   * @param extensionUri - The extension's folder, whose `media/webview` holds the form's script and style.
   * @param schemas - The metadata JSON schemas of the platforms.
   * @param projects - Finds the project of the opened file.
   */
  public constructor(extensionUri: vscode.Uri, private readonly schemas: MetadataSchemaProvider, private readonly projects: ProjectRegistry) {
    this.assets = vscode.Uri.joinPath(extensionUri, 'media', 'webview')
  }

  /**
   * Fills a metadata form panel: renders the form for the project's platform schema, sends it the document text on every change, and writes the field values the form sends back into the document (or reopens the file as text on request).
   *
   * An edit that cannot be applied is shown as an error notification.
   *
   * @param document - The `metadata.json` document.
   * @param panel - The webview panel to fill.
   */
  public async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = { enableScripts: true, localResourceRoots: [this.assets] }
    const project: Project | null = this.projects.byMetadata(document.uri)
    const schema: string = project ? await this.schemas.schema(project.platformName) : '{}'
    panel.webview.html = this.page(panel.webview, JSON.parse(schema) as unknown, project?.platform?.label ?? 'WarpEngine')
    const post = (): void => { void panel.webview.postMessage({ type: 'document', text: document.getText() }) }
    const changes: vscode.Disposable = vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      if (event.document.uri.toString() === document.uri.toString()) post()
    })
    panel.onDidDispose(() => { changes.dispose() })
    panel.webview.onDidReceiveMessage(async (message: FormMessage) => { await MetadataEditor.receive(document, message, post) })
  }

  private static async receive(document: vscode.TextDocument, message: FormMessage, post: () => void): Promise<void> {
    if (message.type === 'ready') post()
    if (message.type === 'source') await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default')
    if (message.type === 'set') await MetadataEditor.apply(document, message)
  }

  private static async apply(document: vscode.TextDocument, message: FieldMessage): Promise<void> {
    try {
      const text: string = new MetadataDocument(document.getText(), 'json').withPath(message.path, message.value)
      const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text)
      await vscode.workspace.applyEdit(edit)
    } catch (error: unknown) {
      Dialogs.error(errorText(error))
    }
  }

  private page(webview: vscode.Webview, schema: unknown, label: string): string {
    const nonce: string = WebviewHtml.nonce()
    const asset = (name: string): string => webview.asWebviewUri(vscode.Uri.joinPath(this.assets, name)).toString()
    const config: string = WebviewHtml.json({ schema, texts: MetadataEditor.texts() })
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'">
<link rel="stylesheet" href="${asset('metadata-form.css')}"></head><body>
<h1>${WebviewHtml.escape(t('{0} metadata', label))}</h1><p class="lead">${WebviewHtml.escape(t('What a publish takes over into the catalog. Changes are written to metadata.json as you type.'))}</p>
<div id="form"></div><div id="error" class="error"></div>
<button id="source">${WebviewHtml.escape(t('Open as text'))}</button>
<script nonce="${nonce}" type="application/json" id="warpengine-config">${config}</script>
<script nonce="${nonce}" src="${asset('metadata-form.js')}"></script>
</body></html>`
  }

  private static texts(): Record<string, string> {
    return {
      notSet: t('(not set)'), byDefault: t('(default)'), webPlay: t('Web play'),
      notJson: t('not JSON'), invalidJson: t('metadata.json is not valid JSON')
    }
  }
}
