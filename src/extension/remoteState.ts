import * as vscode from 'vscode'
import type { Pipeline, PipelineRun, Release, Software } from '../domain/types'
import { devBuildBranch } from '../domain/version'
import { Git } from '../infrastructure/git'
import type { WarpEngineClient } from '../infrastructure/warpEngineClient'
import type { WarpEngineAuth } from './auth'
import type { Project, Projects } from './project'

export interface RemoteState {
  readonly project: Project
  readonly signedIn: boolean
  readonly software: Software | null
  readonly pipeline: Pipeline | null
  readonly runs: readonly PipelineRun[]
  readonly headRun: PipelineRun | null
  readonly releases: readonly Release[]
  readonly head: string | null
  readonly branch: string | null
  readonly defaultBranch: string | null
  readonly branchBuild: Release | null
  readonly error: string | null
}

const RUNNING: ReadonlySet<string> = new Set(['pending', 'running', 'created', 'blocked', 'started'])
const POLL_MS = 10_000
const POLL_LIMIT_MS: number = 20 * 60_000

export class RemoteStates implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<RemoteState | null> = new vscode.EventEmitter<RemoteState | null>()
  public readonly onDidChange: vscode.Event<RemoteState | null> = this.changed.event
  private state: RemoteState | null = null
  private timer: NodeJS.Timeout | undefined
  private pollingSince = 0
  private loading: Promise<void> | null = null
  private readonly announced = new Set<string>()
  private readonly built: vscode.EventEmitter<RemoteState> = new vscode.EventEmitter<RemoteState>()
  public readonly onDidBuildBranch: vscode.Event<RemoteState> = this.built.event

  public constructor(private readonly auth: WarpEngineAuth, private readonly projects: Projects) {}

  public current(): RemoteState | null {
    return this.state
  }

  public isRunning(run: PipelineRun | null): boolean {
    return run !== null && RUNNING.has(run.status)
  }

  public watch(): void {
    this.pollingSince = Date.now()
    void this.refresh()
  }

  public async refresh(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = this.load().finally(() => { this.loading = null })
    return this.loading
  }

  public dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.changed.dispose()
    this.built.dispose()
  }

  private async load(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    const project: Project | null = this.projects.current()
    if (!project) {
      this.publish(null)
      return
    }
    const git: Git = new Git(project.folder.uri.fsPath)
    const head: string | null = await git.head()
    const branch: string | null = await git.branch()
    const defaultBranch: string | null = await git.defaultBranch()
    const client: WarpEngineClient | null = await this.auth.client(false)
    const empty: RemoteState = { project, signedIn: client !== null, software: null, pipeline: null, runs: [], headRun: null, releases: [], head, branch, defaultBranch, branchBuild: null, error: null }
    if (!client) {
      this.publish(empty)
      return
    }
    try {
      const software: Software | null = await client.softwareByName(project.name)
      const pipelines: Pipeline[] = software ? await client.pipelines().catch((): Pipeline[] => []) : []
      const pipeline: Pipeline | null = pipelines.find((candidate: Pipeline) => candidate.softwareId === software?.id)
        ?? pipelines.find((candidate: Pipeline) => candidate.repoName === project.name) ?? null
      const runs: PipelineRun[] = pipeline ? await client.runs(pipeline.id).catch((): PipelineRun[] => []) : []
      const headRun: PipelineRun | null = runs.find((run: PipelineRun) => run.commit !== null && run.commit === head) ?? null
      const releases: Release[] = software ? await client.releases(software.id).catch((): Release[] => []) : []
      const devBranch: string | null = branch && branch !== (defaultBranch ?? 'master') && branch !== 'HEAD' ? branch.replace(/\//g, '-') : null
      const branchBuild: Release | null = devBranch
        ? releases.find((release: Release) => release.version.startsWith('dev-') && devBuildBranch(release.version) === devBranch) ?? null
        : null
      const state: RemoteState = { ...empty, software, pipeline, runs, headRun, releases, branchBuild }
      this.publish(state)
      if (branchBuild) {
        const key = `${String(branchBuild.id)}@${branchBuild.updatedAt ?? branchBuild.createdAt ?? ''}`
        if (this.pollingSince > 0 && !this.announced.has(key)) this.built.fire(state)
        this.announced.add(key)
      }
      const polling: boolean = Date.now() - this.pollingSince < POLL_LIMIT_MS
      if (polling && (headRun === null ? this.pollingSince > 0 : this.isRunning(headRun))) {
        this.timer = setTimeout(() => { void this.refresh() }, POLL_MS)
      } else {
        this.pollingSince = 0
      }
    } catch (error: unknown) {
      this.publish({ ...empty, error: error instanceof Error ? error.message : String(error) })
    }
  }

  private publish(state: RemoteState | null): void {
    this.state = state
    this.changed.fire(state)
  }
}

export class PipelineStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem = vscode.window.createStatusBarItem('warpengine.pipeline', vscode.StatusBarAlignment.Left, 50)
  private readonly subscription: vscode.Disposable

  public constructor(private readonly states: RemoteStates) {
    this.item.name = 'WarpEngine pipeline'
    this.subscription = states.onDidChange((state: RemoteState | null) => { this.render(state) })
  }

  public dispose(): void {
    this.subscription.dispose()
    this.item.dispose()
  }

  private render(state: RemoteState | null): void {
    if (!state) {
      this.item.hide()
      return
    }
    const label = `${state.project.platform?.label ?? state.project.platformName} · ${state.project.name}`
    if (!state.signedIn) {
      this.item.text = `$(rocket) ${label}`
      this.item.tooltip = 'WarpEngine: sign in to see the pipeline'
      this.item.command = 'warpengine.signIn'
    } else if (!state.pipeline) {
      this.item.text = `$(rocket) ${label}`
      this.item.tooltip = state.software ? 'No pipeline is linked to this software' : 'Not on WarpEngine yet: Connect creates the repository, CI and catalog entry'
      this.item.command = state.software ? 'warpengine.refresh' : 'warpengine.connect'
    } else {
      const run: PipelineRun | null = state.headRun ?? state.runs[0] ?? null
      const icon: string = run === null ? '$(circle-outline)' : this.states.isRunning(run) ? '$(sync~spin)' : run.status === 'success' ? '$(pass-filled)' : '$(error)'
      this.item.text = `${icon} ${label}${run ? ` · ${run.status}` : ''}`
      this.item.tooltip = run ? `Pipeline #${String(run.number)} (${run.event ?? ''} ${run.branch ?? ''}) ${run.commit?.slice(0, 7) ?? ''}${state.headRun ? '' : ' — not of the current commit'}` : 'No runs yet'
      this.item.command = run?.url ? { title: 'Open', command: 'warpengine.openUrl', arguments: [run.url] } : 'warpengine.refresh'
    }
    this.item.show()
  }
}

export function watchGit(onChange: () => void): vscode.Disposable {
  const git = vscode.extensions.getExtension<GitExtension>('vscode.git')
  if (!git) return new vscode.Disposable(() => undefined)
  const disposables: vscode.Disposable[] = []
  const hook = (api: GitApi): void => {
    const attach = (repository: GitRepository): void => {
      let head: string | undefined = repository.state.HEAD?.commit
      let ahead: number | undefined = repository.state.HEAD?.ahead
      disposables.push(repository.state.onDidChange(() => {
        const nextHead: string | undefined = repository.state.HEAD?.commit
        const nextAhead: number | undefined = repository.state.HEAD?.ahead
        if (nextHead !== head || (ahead !== undefined && ahead > 0 && nextAhead === 0)) onChange()
        head = nextHead
        ahead = nextAhead
      }))
    }
    api.repositories.forEach(attach)
    disposables.push(api.onDidOpenRepository(attach))
  }
  void Promise.resolve(git.isActive ? git.exports : git.activate()).then((exports: GitExtension) => { hook(exports.getAPI(1)) }).catch(() => undefined)
  return new vscode.Disposable(() => { for (const disposable of disposables) disposable.dispose() })
}

interface GitExtension { getAPI(version: 1): GitApi }
interface GitApi { readonly repositories: GitRepository[]; readonly onDidOpenRepository: vscode.Event<GitRepository> }
// eslint-disable-next-line @typescript-eslint/naming-convention -- the git extension's own field name
interface GitRepository { readonly state: { readonly HEAD: { readonly commit?: string; readonly ahead?: number } | undefined; readonly onDidChange: vscode.Event<void> } }
