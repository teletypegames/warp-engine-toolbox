import * as vscode from 'vscode'
import { readLuaHeader, type HeaderLine } from '../domain/luaHeader'
import type { PublishCheck, PublishProblem } from '../domain/types'
import type { WarpEngineAuth } from './auth'
import type { Hosts } from './hosts'
import type { Project, Projects } from './project'

export class PublishDiagnostics implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('warpengine')
  private readonly disposables: { dispose(): unknown }[]

  public constructor(private readonly hosts: Hosts, private readonly projects: Projects, private readonly auth: WarpEngineAuth) {
    this.disposables = [
      this.collection,
      vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        if (!vscode.workspace.getConfiguration('warpengine').get<boolean>('checkOnSave', true)) return
        const project: Project | undefined = this.projects.all().find((candidate: Project) => candidate.metadataUri?.toString() === document.uri.toString())
        if (project) void this.check(project, false)
      })
    ]
  }

  public async check(project: Project, report: boolean): Promise<PublishCheck | null> {
    if (!project.metadataUri || !project.platform) return null
    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(project.metadataUri)
    const metadata: Record<string, unknown> = project.metadataFormat === 'json' ? parseJson(document.getText()) : headerObject(document.getText())
    const version: string | null = await this.projects.version(project)
    const token: string | null = await this.auth.token(false)
    let result: PublishCheck
    try {
      result = await this.hosts.client(token).check({ platform: project.platformName, metadata, version, kinds: null })
    } catch (error: unknown) {
      if (report) void vscode.window.showErrorMessage(`WarpEngine check: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
    this.collection.set(project.metadataUri, result.problems.map((problem: PublishProblem) => diagnostic(document, project, problem)))
    if (report) {
      if (result.problems.length === 0) void vscode.window.showInformationMessage('WarpEngine: a publish would take this metadata as it is.')
      else await vscode.commands.executeCommand('workbench.actions.view.problems')
    }
    return result
  }

  public dispose(): void {
    for (const disposable of this.disposables) disposable.dispose()
  }
}

function diagnostic(document: vscode.TextDocument, project: Project, problem: PublishProblem): vscode.Diagnostic {
  const range: vscode.Range = locate(document, project, problem.field)
  const severity: vscode.DiagnosticSeverity = problem.level === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
  const item: vscode.Diagnostic = new vscode.Diagnostic(range, problem.message, severity)
  item.source = 'WarpEngine'
  item.code = problem.field
  return item
}

function locate(document: vscode.TextDocument, project: Project, field: string): vscode.Range {
  const text: string = document.getText()
  if (project.metadataFormat === 'lua') {
    const line: HeaderLine | undefined = readLuaHeader(text).find((entry: HeaderLine) => entry.key === field)
    return line ? document.lineAt(line.line).range : document.lineAt(0).range
  }
  const index: number = text.indexOf(`"${field}"`)
  if (index < 0) return new vscode.Range(0, 0, 0, 1)
  const start: vscode.Position = document.positionAt(index)
  return new vscode.Range(start, document.positionAt(index + field.length + 2))
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function headerObject(text: string): Record<string, unknown> {
  return Object.fromEntries(readLuaHeader(text).filter((entry: HeaderLine) => entry.key !== 'script').map((entry: HeaderLine) => [entry.key, entry.value]))
}
