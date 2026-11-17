import * as vscode from 'vscode'
import { setLuaHeaderValue } from '../domain/luaHeader'
import type { ScaffoldResult } from '../domain/types'
import { Git } from '../infrastructure/git'
import type { WarpEngineAuth } from './auth'
import { readText, writeText, type Project, type Projects } from './project'

export async function connectProject(auth: WarpEngineAuth, projects: Projects, project: Project): Promise<ScaffoldResult | null> {
  const client = await auth.client(true)
  if (!client) return null
  const git: Git = new Git(project.folder.uri.fsPath)
  if (await git.isRepository() && await git.remote()) {
    const go = 'Connect anyway'
    const answer: string | undefined = await vscode.window.showWarningMessage(
      `This repository already has a remote (${await git.remote() ?? ''}). Connecting creates a new repository and points origin at it.`, { modal: true }, go)
    if (answer !== go) return null
  }
  const title: string = stringField(project.metadata['title']) ?? project.name
  const description: string = stringField(project.metadata['desc']) ?? title
  const category: string | null = stringField(project.metadata['category'])

  const result: ScaffoldResult = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `WarpEngine: connecting ${project.name}` },
    async (progress: vscode.Progress<{ message?: string }>) => {
      progress.report({ message: 'creating the repository, CI and the catalog entry…' })
      const scaffold: ScaffoldResult = await client.scaffold({ name: project.name, title, platform: project.platformName, category, description })
      progress.report({ message: 'pointing the working copy at it…' })
      await recordRepository(project, scaffold.repository.htmlUrl)
      const remote: string | null = await chooseRemote(scaffold)
      if (!(await git.isRepository())) await git.init('master')
      if (remote) await git.setRemote(remote)
      await git.addAll()
      if (!(await git.isClean()) || !(await git.hasCommits())) await git.commit(`Start ${title} on WarpEngine`)
      if (remote) {
        progress.report({ message: 'pushing: the first build starts…' })
        await git.push(['-u', 'origin', (await git.branch()) ?? 'master'])
      }
      return scaffold
    }
  )
  await projects.refresh()
  const warnings: string = result.warnings.length > 0 ? ` Warnings: ${result.warnings.join('; ')}` : ''
  void vscode.window.showInformationMessage(`${project.name} is on WarpEngine: ${result.repository.htmlUrl ?? result.repository.name}.${warnings}`)
  return result
}

async function chooseRemote(scaffold: ScaffoldResult): Promise<string | null> {
  const options: (vscode.QuickPickItem & { url: string })[] = []
  if (scaffold.repository.sshUrl) options.push({ label: 'SSH', description: scaffold.repository.sshUrl, url: scaffold.repository.sshUrl })
  if (scaffold.repository.cloneUrl) options.push({ label: 'HTTPS', description: scaffold.repository.cloneUrl, url: scaffold.repository.cloneUrl })
  if (options.length <= 1) return options[0]?.url ?? null
  const picked = await vscode.window.showQuickPick(options, { title: 'Push to the new repository over', ignoreFocusOut: true })
  return picked?.url ?? options[0]?.url ?? null
}

async function recordRepository(project: Project, url: string | null): Promise<void> {
  if (!url || !project.metadataUri) return
  const text: string | null = await readText(project.metadataUri)
  if (text === null) return
  if (project.metadataFormat === 'json') {
    try {
      const metadata: Record<string, unknown> = JSON.parse(text) as Record<string, unknown>
      metadata['repo'] = url
      metadata['site'] ??= url
      await writeText(project.metadataUri, `${JSON.stringify(metadata, null, 2)}\n`)
    } catch {
      /* leave a broken file alone */
    }
  } else if (project.metadataFormat === 'lua') {
    await writeText(project.metadataUri, setLuaHeaderValue(text, 'site', url))
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
