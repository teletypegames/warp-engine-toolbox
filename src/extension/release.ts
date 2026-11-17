import * as vscode from 'vscode'
import { changelog, prependChangelog, type Commit } from '../domain/changelog'
import { setLuaHeaderValue } from '../domain/luaHeader'
import type { PublishCheck, PublishProblem } from '../domain/types'
import { betaCandidates, stableCandidates } from '../domain/version'
import { Git } from '../infrastructure/git'
import type { Hosts } from './hosts'
import { readText, writeText, type Project, type Projects } from './project'

export async function release(hosts: Hosts, projects: Projects, onPushed: () => void): Promise<void> {
  const project: Project = projects.require()
  const git: Git = new Git(project.folder.uri.fsPath)
  if (!(await git.isRepository()) || !(await git.remote())) {
    void vscode.window.showErrorMessage('Connect the project first: a release is a tag the CI builds.')
    return
  }
  if (!(await git.isClean())) {
    const commit = 'Commit everything first'
    const answer: string | undefined = await vscode.window.showWarningMessage('The working copy has changes.', { modal: true }, commit)
    if (answer !== commit) return
    await git.addAll()
    await git.commit('Work before the release')
  }
  if (!project.metadataUri || project.metadataFormat === 'custom') {
    void vscode.window.showErrorMessage('This platform reads its version in a way the toolbox cannot write; bump it by hand and push a vX.Y.Z tag.')
    return
  }

  const current: string = (await projects.version(project)) ?? '0.0.0'
  const channel = await vscode.window.showQuickPick([
    { label: 'Stable', description: 'everyone gets it: the catalog, the client, the store outlets', id: 'stable' as const },
    { label: 'Beta', description: 'a pre-release (1.3.0-beta.1): listed, offered only to those who ask for beta', id: 'beta' as const }
  ], { title: `Release ${project.name} (now ${current}): channel` })
  if (!channel) return
  const candidates: string[] = channel.id === 'beta' ? betaCandidates(current) : stableCandidates(current)
  const picked = await vscode.window.showQuickPick(
    [...candidates.map((label: string) => ({ label, custom: false })), { label: 'Another version…', custom: true }],
    { title: `Release ${project.name}: ${channel.label.toLowerCase()} version` }
  )
  if (!picked) return
  let version: string | undefined = picked.custom ? await vscode.window.showInputBox({
    title: 'Version', value: candidates[0] ?? '1.0.0',
    validateInput: (value: string) => /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(value) ? null : 'MAJOR.MINOR.PATCH, with -beta.N for a pre-release'
  }) : picked.label
  if (!version) return
  version = version.replace(/^v/, '')

  const check: PublishCheck | null = await hosts.client().check({ platform: project.platformName, metadata: { ...project.metadata, version }, version, kinds: null }).catch(() => null)
  const errors: PublishProblem[] = check?.problems.filter((problem: PublishProblem) => problem.level === 'error') ?? []
  if (errors.length > 0) {
    void vscode.window.showErrorMessage(`The publish would fail: ${errors.map((problem: PublishProblem) => `${problem.field}: ${problem.message}`).join('; ')}`)
    return
  }

  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `WarpEngine: releasing ${project.name} ${version}` }, async (progress: vscode.Progress<{ message?: string }>) => {
    progress.report({ message: 'writing the version and the changelog…' })
    await writeVersion(project, version)
    await git.fetchTags()
    const commits: Commit[] = await git.commitsSince(await git.lastTag())
    const entry: string = changelog(version, commits, new Date().toISOString().slice(0, 10))
    const changelogUri: vscode.Uri = vscode.Uri.joinPath(project.folder.uri, 'CHANGELOG.md')
    await writeText(changelogUri, prependChangelog(await readText(changelogUri), entry))
    await git.addAll()
    await git.commit(`Release ${version}`)
    await git.tag(`v${version}`, entry)
    progress.report({ message: 'pushing the tag: the CI builds and publishes it…' })
    await git.push(['origin', 'HEAD', `v${version}`])
  })
  onPushed()
  void vscode.window.showInformationMessage(`v${version} is pushed; the pipeline builds and publishes it. Its state shows in the status bar.`)
}

async function writeVersion(project: Project, version: string): Promise<void> {
  if (!project.metadataUri) return
  const text: string = (await readText(project.metadataUri)) ?? ''
  if (project.metadataFormat === 'lua') {
    await writeText(project.metadataUri, setLuaHeaderValue(text, 'version', version))
    return
  }
  const metadata: Record<string, unknown> = text ? JSON.parse(text) as Record<string, unknown> : {}
  metadata['version'] = version
  await writeText(project.metadataUri, `${JSON.stringify(metadata, null, 2)}\n`)
}
