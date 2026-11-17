import * as vscode from 'vscode'
import { checklist, checklistMark } from '../domain/checklist'
import type { Pipeline, PipelineRun, Release, Software } from '../domain/types'
import { Git } from '../infrastructure/git'
import { WarpEngineAuth } from './auth'
import { catalogRoots, type FieldData } from './catalogView'
import { connectProject } from './connect'
import { PublishDiagnostics } from './diagnostics'
import { Hosts } from './hosts'
import { registerMarkerSupport } from './markerSupport'
import { registerMcp } from './mcp'
import { METADATA_VIEW, MetadataEditor } from './metadataEditor'
import { addToProject, newGame } from './newGame'
import { Player } from './play'
import { Platforms } from './platforms'
import { Projects, type Project } from './project'
import { projectRoots } from './projectView'
import { release } from './release'
import { PipelineStatusBar, RemoteStates, watchGit } from './remoteState'
import { Reports } from './reports'
import { SchemaProvider } from './schema'
import { runTarget, TASK_TYPE, WarpTasks } from './tasks'
import { Node, NodeProvider } from './tree'

export interface ToolboxApi {
  readonly projects: Projects
  readonly platforms: Platforms
  readonly schemas: SchemaProvider
  readonly diagnostics: PublishDiagnostics
  readonly player: Player
  readonly hosts: Hosts
}

export async function activate(context: vscode.ExtensionContext): Promise<ToolboxApi> {
  const hosts: Hosts = new Hosts()
  const auth: WarpEngineAuth = new WarpEngineAuth(context.secrets, hosts)
  const platforms: Platforms = new Platforms(context.globalState, hosts)
  const projects: Projects = new Projects(platforms)
  const schemas: SchemaProvider = new SchemaProvider(hosts, projects)
  const diagnostics: PublishDiagnostics = new PublishDiagnostics(hosts, projects, auth)
  const tasks: WarpTasks = new WarpTasks(projects)
  const states: RemoteStates = new RemoteStates(auth, projects)
  const player: Player = new Player(hosts, projects, tasks)
  const reports: Reports = new Reports()
  const projectTree: NodeProvider = new NodeProvider(projectRoots(hosts, projects, states))
  const catalogTree: NodeProvider = new NodeProvider(catalogRoots(hosts, auth, platforms))

  const refreshAll = async (): Promise<void> => {
    await platforms.all(true).catch(() => undefined)
    await projects.refresh()
    await states.refresh()
    catalogTree.refresh()
  }

  context.subscriptions.push(
    hosts, auth, projects, schemas, diagnostics, states, player, reports, projectTree, catalogTree,
    new PipelineStatusBar(states),
    vscode.window.registerTreeDataProvider('warpengine.project', projectTree),
    vscode.window.registerTreeDataProvider('warpengine.catalog', catalogTree),
    vscode.window.registerCustomEditorProvider(METADATA_VIEW, new MetadataEditor(schemas, projects)),
    vscode.tasks.registerTaskProvider(TASK_TYPE, tasks),
    ...registerMarkerSupport(platforms),
    ...registerMcp(hosts, auth),
    projects.onDidChange(() => { projectTree.refresh(); void states.refresh() }),
    states.onDidChange(() => { projectTree.refresh() }),
    auth.onDidChangeSessions(() => { catalogTree.refresh(); void states.refresh() }),
    hosts.onDidChange(() => { void refreshAll() }),
    vscode.window.onDidChangeWindowState((state: vscode.WindowState) => { if (state.focused) void states.refresh() }),
    watchGit(() => { states.watch() }),

    command('warpengine.newGame', async () => { await newGame(hosts, platforms) }),
    command('warpengine.addToProject', async () => { await addToProject(hosts, platforms, projects, auth) }),
    command('warpengine.connect', async () => {
      await connectProject(auth, projects, projects.require())
      states.watch()
    }),
    command('warpengine.signIn', async () => {
      await auth.token(true)
      await refreshAll()
    }),
    command('warpengine.signOut', async () => {
      await auth.signOut()
      await refreshAll()
    }),
    command('warpengine.selectHost', async () => { await hosts.select() }),
    command('warpengine.previewPipeline', async () => {
      const project: Project = projects.require()
      const yaml: string = await hosts.client().pipelinePreview(project.platformName, project.marker.name ?? project.name)
      await reports.show(`${project.name}-pipeline.yaml`, yaml, false)
    }),
    command('warpengine.play', async () => { await player.play() }),
    command('warpengine.buildLikeCi', async () => {
      const project: Project = projects.require()
      if (!project.platform?.ci.builder) throw new Error('The host names no builder image for this platform.')
      const ok: boolean = await runTarget(tasks, project, 'build', true)
      void (ok ? vscode.window.showInformationMessage('The CI builder built it.') : vscode.window.showErrorMessage('The CI builder failed; see the terminal.'))
    }),
    command('warpengine.checkPublish', async () => { await diagnostics.check(projects.require(), true) }),
    command('warpengine.release', async () => { await release(hosts, projects, () => { states.watch() }) }),
    command('warpengine.editMetadata', async (uri?: vscode.Uri) => {
      const target: vscode.Uri | null = uri ?? vscode.window.activeTextEditor?.document.uri ?? projects.current()?.metadataUri ?? null
      if (!target) throw new Error('This project has no metadata file.')
      await vscode.commands.executeCommand('vscode.openWith', target, target.path.endsWith('.json') ? METADATA_VIEW : 'default')
    }),
    command('warpengine.refresh', refreshAll),
    command('warpengine.openUrl', async (target?: string | Node) => {
      const url: string | undefined = typeof target === 'string' ? target : linkOf(target)
      if (url) await vscode.env.openExternal(vscode.Uri.parse(url))
    }),
    command('warpengine.triggerPipeline', async (node?: Node) => {
      const client = await auth.client(true)
      const pipeline: Pipeline | null = (node?.data as Pipeline | undefined) ?? states.current()?.pipeline ?? null
      if (!client || !pipeline) return
      const folder: Project | null = projects.current()
      const branch: string = (folder ? await new Git(folder.folder.uri.fsPath).branch() : null) ?? 'master'
      const run: PipelineRun = await client.trigger(pipeline.id, branch)
      void vscode.window.showInformationMessage(`Pipeline #${String(run.number)} started on ${branch}.`)
      states.watch()
    }),
    command('warpengine.editSoftwareField', async (node?: Node) => {
      const data: FieldData | undefined = node?.data as FieldData | undefined
      const client = await auth.client(true)
      if (!data || !client) return
      const value: unknown = await askField(data, client)
      if (value === undefined) return
      await client.updateSoftware(data.software.id, { [data.field]: value })
      catalogTree.refresh()
    }),
    command('warpengine.showChecklist', async (node?: Node) => {
      const data = node?.data as { release: Release; project: Project } | undefined
      if (!data?.project.platform) return
      const lines: string[] = checklist(data.project.platform, data.release.assets).map((entry) => `- \`${checklistMark(entry.state)}\` **${entry.kind}** ${entry.note}`)
      await reports.show(`${data.project.name}-${data.release.version}-checklist.md`, [`# ${data.project.name} ${data.release.version}`, '', ...lines, ''].join('\n'))
    }),
    command('warpengine.showStatistics', async (node?: Node) => {
      const software: Software | undefined = node?.data as Software | undefined
      const client = await auth.client(true)
      if (!software || !client) return
      const stats: unknown = await client.downloadStats(software.id)
      await reports.show(`${software.name}-downloads.md`, `# ${software.title}: downloads\n\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\`\n`)
    })
  )

  await projects.refresh()
  await vscode.commands.executeCommand('setContext', 'warpengine.signedIn', (await auth.token(false)) !== null)
  return { projects, platforms, schemas, diagnostics, player, hosts }
}

export function deactivate(): void {
  /* the subscriptions dispose everything */
}

function command(id: string, handler: (...args: never[]) => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand(id, async (...args: never[]) => {
    try {
      await handler(...args)
    } catch (error: unknown) {
      if (error instanceof vscode.CancellationError) return
      void vscode.window.showErrorMessage(`WarpEngine: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

function linkOf(node: Node | undefined): string | undefined {
  const argument: unknown = node?.command?.arguments?.[0]
  return typeof argument === 'string' ? argument : undefined
}

async function askField(data: FieldData, client: { categories: () => Promise<{ key: string; label: string }[]>; adminRaw: (method: string, path: string) => Promise<unknown> }): Promise<unknown> {
  switch (data.field) {
    case 'highlighted': {
      const picked: string | undefined = await vscode.window.showQuickPick(['yes', 'no'], { title: `Highlight ${data.software.title}?` })
      return picked === undefined ? undefined : picked === 'yes'
    }
    case 'category': {
      const categories = await client.categories().catch(() => [])
      const picked = await vscode.window.showQuickPick([{ label: '(none)', key: null as string | null }, ...categories.map((item) => ({ label: item.label, description: item.key, key: item.key }))], { title: 'Category' })
      return picked === undefined ? undefined : picked.key
    }
    case 'status': {
      const answer: unknown = await client.adminRaw('GET', '/software_statuses').catch(() => [])
      const keys: string[] = Array.isArray(answer) ? answer.map((item: { key?: string }) => item.key ?? '').filter(Boolean) : ['released', 'demo', 'development', 'archived']
      return vscode.window.showQuickPick(keys, { title: 'Status' })
    }
    case 'title':
      return vscode.window.showInputBox({ title: 'Title', value: data.software.title })
  }
}
