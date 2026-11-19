import * as vscode from 'vscode'
import { listedReleases, type Release } from '../../../domain/model/catalog.model'
import { isRunning, isSuccess, type PipelineRun } from '../../../domain/model/pipeline.model'
import type { Project } from '../../../domain/model/project.model'
import { isOnSideBranch, latestRun, type RemoteState } from '../../../domain/model/remote-state.model'
import type { HostService } from '../../../domain/service/host.service'
import type { LocalEngineService } from '../../../domain/service/local-engine.service'
import type { PlayService } from '../../../domain/service/play.service'
import { t } from '../../ui/l10n'
import type { ProjectRegistry } from '../../workspace/project.registry'
import type { RemoteStateStore } from '../../workspace/remote-state.store'
import { PlatformFormatter } from '../platform/platform.formatter'
import { ReleaseNode } from './release.node'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

const RUN_LIMIT = 10
const RELEASE_LIMIT = 15

export interface ProjectTreeDependencies {
  readonly hosts: HostService
  readonly projects: ProjectRegistry
  readonly states: RemoteStateStore
  readonly play: PlayService
  readonly local: LocalEngineService
}

export class ProjectTreeView implements TreeView {
  private readonly hosts: HostService
  private readonly projects: ProjectRegistry
  private readonly states: RemoteStateStore
  private readonly play: PlayService
  private readonly local: LocalEngineService

  public constructor(deps: ProjectTreeDependencies) {
    this.hosts = deps.hosts
    this.projects = deps.projects
    this.states = deps.states
    this.play = deps.play
    this.local = deps.local
  }

  public async roots(): Promise<TreeNode[]> {
    const project: Project | null = this.projects.current()
    if (!project) return []
    const nodes: TreeNode[] = [this.platformNode(project), ...(await this.localNodes(project))]
    const state: RemoteState | null = this.states.current()
    if (!state?.signedIn) return [...nodes, this.signInNode()]
    return [...nodes, ...this.remoteNodes(project, state)]
  }

  private platformNode(project: Project): TreeNode {
    const docs: string | null = project.platform?.docsUrl ?? null
    return new TreeNode(project.platformLabel, {
      description: project.platform ? project.platformName : t('unknown on this host'), icon: 'circuit-board',
      tooltip: project.platform ? new vscode.MarkdownString(PlatformFormatter.describe(project.platform)) : t('The host does not know this platform'),
      ...(docs ? { context: 'docs', data: docs } : {})
    })
  }

  private async localNodes(project: Project): Promise<TreeNode[]> {
    const version: string | null = await this.projects.version(project)
    const nodes: TreeNode[] = [new TreeNode(project.name, { description: version ?? t('no version'), icon: 'tag' })]
    if (project.metadataPath) nodes.push(this.metadataNode(project.metadataPath))
    nodes.push(
      new TreeNode(t('Play'), { description: project.platform?.web.length ? t('in the web runtime') : t('the web build'), icon: 'play', command: { title: t('Play'), command: 'warpengine.play' } }),
      new TreeNode(t('Check publish'), { icon: 'checklist', command: { title: t('Check'), command: 'warpengine.checkPublish' } })
    )
    return nodes
  }

  private metadataNode(path: string): TreeNode {
    const uri: vscode.Uri = vscode.Uri.file(path)
    return new TreeNode(t('Metadata'), { description: vscode.workspace.asRelativePath(uri), icon: 'json', command: { title: t('Open'), command: 'warpengine.editMetadata', arguments: [uri] } })
  }

  private signInNode(): TreeNode {
    return new TreeNode(t('Sign in'), { description: this.hosts.current()?.name ?? t('set a host first'), icon: 'sign-in', command: { title: t('Sign in'), command: 'warpengine.signIn' } })
  }

  private remoteNodes(project: Project, state: RemoteState): TreeNode[] {
    const nodes: TreeNode[] = state.error ? [new TreeNode(state.error, { icon: 'warning' })] : []
    const start: TreeNode[] = this.startNodes(state)
    if (!state.software) return [...nodes, ...start]
    nodes.push(...start)
    nodes.push(new TreeNode(t('Release…'), { description: t('bump, tag, push'), icon: 'rocket', command: { title: t('Release'), command: 'warpengine.release' } }))
    if (state.pipeline) nodes.push(this.pipelineNode(state))
    if (isOnSideBranch(state)) nodes.push(this.branchNode(project, state))
    nodes.push(this.releasesNode(project, state))
    return nodes
  }

  private startNodes(state: RemoteState): TreeNode[] {
    if (this.local.isLocal(this.hosts.current()?.url ?? '')) return state.pipeline ? [] : [ProjectTreeView.localCiNode()]
    return state.software ? [] : [this.connectNode()]
  }

  private static localCiNode(): TreeNode {
    return new TreeNode(t('Set up local CI'), {
      description: t('git server + CI on this machine'), icon: 'server-environment',
      command: { title: t('Set up local CI'), command: 'warpengine.setupLocalCi' }
    })
  }

  private connectNode(): TreeNode {
    return new TreeNode(t('Connect'), { description: t('repository, CI and catalog entry'), icon: 'plug', command: { title: t('Connect'), command: 'warpengine.connect' } })
  }

  private pipelineNode(state: RemoteState): TreeNode {
    const run: PipelineRun | null = latestRun(state)
    const description: string = run ? `#${String(run.number)} ${run.status}${state.headRun ? '' : ` ${t('(not HEAD)')}`}` : t('no runs')
    return new TreeNode(t('Pipeline'), {
      description, icon: 'server-process', context: 'pipeline', data: state.pipeline, expanded: false,
      load: (): TreeNode[] => state.runs.slice(0, RUN_LIMIT).map((item: PipelineRun) => ProjectTreeView.runNode(item))
    })
  }

  private static runNode(run: PipelineRun): TreeNode {
    return new TreeNode(`#${String(run.number)} ${run.status}`, {
      description: `${run.event ?? ''} ${run.branch ?? ''} ${run.commit?.slice(0, 7) ?? ''}`.trim(),
      tooltip: run.message ?? '', icon: ProjectTreeView.runIcon(run),
      ...(run.url ? { command: TreeNode.openUrl(run.url), context: 'link' } : {})
    })
  }

  private static runIcon(run: PipelineRun): string {
    if (isSuccess(run)) return 'pass'
    return isRunning(run) ? 'sync' : 'error'
  }

  private branchNode(project: Project, state: RemoteState): TreeNode {
    const build: Release | null = state.branchBuild
    const url: string | null = build ? this.play.playUrl(project.name, build.version) : null
    return new TreeNode(t('This branch'), {
      description: build ? `${state.branch ?? ''} · ${build.version}` : `${state.branch ?? ''} · ${t('no build yet (push it)')}`,
      icon: 'git-branch', tooltip: t('The development build of this branch: not listed in the catalog, playable by its link'),
      ...(url ? { command: TreeNode.openUrl(url), context: 'link branchbuild' } : {})
    })
  }

  private releasesNode(project: Project, state: RemoteState): TreeNode {
    const releases: Release[] = listedReleases(state.releases)
    return new TreeNode(t('Releases'), {
      description: String(releases.length), icon: 'versions', expanded: true,
      load: (): TreeNode[] => releases.slice(0, RELEASE_LIMIT).map((release: Release) =>
        ReleaseNode.create({ release, name: project.name, platform: project.platform }, this.play.playUrl(project.name, release.version)))
    })
  }
}
