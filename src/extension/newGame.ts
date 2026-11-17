import { homedir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import { NAME_PATTERN, type GameAnswers } from '../domain/template'
import type { Category, PlatformDescription } from '../domain/types'
import { Git } from '../infrastructure/git'
import { run } from '../infrastructure/process'
import type { WarpEngineAuth } from './auth'
import { connectProject } from './connect'
import type { Hosts } from './hosts'
import { describe } from './markerSupport'
import type { Platforms } from './platforms'
import type { Project, Projects } from './project'
import { exists, writeProject, type WriteResult } from './scaffolding'

const LICENSES: readonly string[] = ['MIT', 'GPL-3.0-or-later', 'Apache-2.0', 'CC-BY-4.0', 'CC-BY-NC-4.0', 'Proprietary']

export async function newGame(hosts: Hosts, platforms: Platforms): Promise<void> {
  const platform: PlatformDescription | null = await pickPlatform(platforms, 'New game: platform')
  if (!platform) return
  const answers: GameAnswers | null = await askAnswers(hosts, platform, null)
  if (!answers) return

  const defaultLocation: string = (vscode.workspace.getConfiguration('warpengine').get<string>('defaultLocation') ?? '').trim() || homedir()
  const parent: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
    title: `Where should the ${answers.name} folder go?`, canSelectFolders: true, canSelectFiles: false,
    defaultUri: vscode.Uri.file(defaultLocation), openLabel: 'Create the project here'
  })
  if (!parent?.[0]) return
  const folder: string = join(parent[0].fsPath, answers.name)
  if (await exists(folder)) {
    void vscode.window.showErrorMessage(`${folder} exists already.`)
    return
  }
  const withDemo: boolean = typeof platform.tooling['demo'] === 'string'
    ? (await vscode.window.showQuickPick(['Start from the demo game', 'Start from the template only'], { title: 'Starting point' })) !== 'Start from the template only'
    : false

  const result: WriteResult = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `WarpEngine: creating ${answers.title}` },
    async (progress: vscode.Progress<{ message?: string }>) => {
      const written: WriteResult = await writeProject({
        folder, platform, answers, host: hosts.current().url, withDemo, overwrite: true,
        report: (message: string) => { progress.report({ message }) }
      })
      progress.report({ message: 'Making it a git repository…' })
      const git: Git = new Git(folder)
      await git.init('master')
      await git.addAll()
      await git.commit(`Start ${answers.title}`).catch(() => undefined)
      return written
    }
  )

  const open = 'Open'
  const add = 'Add to Workspace'
  const answer: string | undefined = await vscode.window.showInformationMessage(
    `${answers.title} is ready (${String(result.written.length)} files). Open it to build, play and connect it.`, open, add)
  if (answer === open) await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folder), { forceNewWindow: false })
  if (answer === add) vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri: vscode.Uri.file(folder) })
}

export async function addToProject(hosts: Hosts, platforms: Platforms, projects: Projects, auth: WarpEngineAuth): Promise<void> {
  const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.length === 1
    ? vscode.workspace.workspaceFolders[0]
    : await vscode.window.showWorkspaceFolderPick({ placeHolder: 'The project to add WarpEngine to' })
  if (!folder) return
  const platform: PlatformDescription | null = await pickPlatform(platforms, `${folder.name}: platform`)
  if (!platform) return
  const answers: GameAnswers | null = await askAnswers(hosts, platform, folder.name)
  if (!answers) return
  const result: WriteResult = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `WarpEngine: adding ${platform.label} to ${folder.name}` },
    async (progress: vscode.Progress<{ message?: string }>) => writeProject({
      folder: folder.uri.fsPath, platform, answers, host: hosts.current().url, withDemo: false, overwrite: false,
      report: (message: string) => { progress.report({ message }) }
    })
  )
  await projects.refresh()
  const skipped: string = result.skipped.length > 0 ? ` Kept your own: ${result.skipped.join(', ')}.` : ''
  const connect = 'Connect'
  const answer: string | undefined = await vscode.window.showInformationMessage(`Added ${result.written.join(', ')}.${skipped}`, connect)
  const project: Project | null = projects.current()
  if (answer === connect && project) await connectProject(auth, projects, project)
}

export async function pickPlatform(platforms: Platforms, title: string): Promise<PlatformDescription | null> {
  const all: PlatformDescription[] = await platforms.all(true)
  const picked = await vscode.window.showQuickPick(
    all.map((platform: PlatformDescription) => ({
      label: platform.label,
      description: platform.name,
      detail: `${platform.kinds.map((kind) => kind.name).join(', ')}${platform.web.length > 0 ? ' · plays on the web' : ''}${typeof platform.tooling['template'] === 'string' ? '' : ' · no template on this host'}`,
      platform
    })),
    { title, matchOnDetail: true, ignoreFocusOut: true }
  )
  if (picked) void vscode.window.setStatusBarMessage(describe(picked.platform).split('\n')[0] ?? '', 4000)
  return picked?.platform ?? null
}

async function askAnswers(hosts: Hosts, platform: PlatformDescription, suggestedName: string | null): Promise<GameAnswers | null> {
  const nameSuggestion: string = (suggestedName ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const name: string | undefined = await vscode.window.showInputBox({
    title: `New ${platform.label} game: name`, prompt: 'The software and repository name: lower-case letters, digits and dashes',
    value: nameSuggestion, ignoreFocusOut: true,
    validateInput: (value: string) => NAME_PATTERN.test(value) ? null : 'Lower-case letters, digits and dashes, starting with a letter or digit'
  })
  if (!name) return null
  const title: string | undefined = await vscode.window.showInputBox({ title: 'Title', value: titleize(name), ignoreFocusOut: true, validateInput: (value: string) => value.trim() ? null : 'A title' })
  if (!title) return null
  const description: string | undefined = await vscode.window.showInputBox({ title: 'One-line description', placeHolder: 'What the catalog says of it', ignoreFocusOut: true })
  if (description === undefined) return null
  const gitName: string = (await run('git', ['config', 'user.name'], homedir())).stdout.trim()
  const author: string | undefined = await vscode.window.showInputBox({ title: 'Author', value: gitName, ignoreFocusOut: true })
  if (author === undefined) return null
  const license: string | undefined = await vscode.window.showQuickPick([...LICENSES], { title: 'Licence', ignoreFocusOut: true })
  if (!license) return null
  const categories: Category[] = await hosts.client().categories().catch((): Category[] => [])
  const category = await vscode.window.showQuickPick(
    [{ label: 'No category', key: null as string | null }, ...categories.map((item: Category) => ({ label: item.label, description: item.key, key: item.key }))],
    { title: 'Category', ignoreFocusOut: true }
  )
  if (!category) return null
  return { name, title: title.trim(), author: author.trim(), license, category: category.key, description: description.trim() || title.trim(), version: '0.1.0' }
}

function titleize(name: string): string {
  return name.split('-').filter(Boolean).map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
