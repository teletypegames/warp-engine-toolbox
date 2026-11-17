import * as vscode from 'vscode'
import { checklist, checklistMark } from '../domain/checklist'
import type { PipelineRun, Release, ReleaseAsset } from '../domain/types'
import type { Hosts } from './hosts'
import { describe } from './markerSupport'
import type { Project, Projects } from './project'
import type { RemoteState, RemoteStates } from './remoteState'
import { Node, openUrl } from './tree'

export function projectRoots(hosts: Hosts, projects: Projects, states: RemoteStates): () => Promise<Node[]> {
  return async (): Promise<Node[]> => {
    const project: Project | null = projects.current()
    if (!project) return []
    const state: RemoteState | null = states.current()
    const version: string | null = await projects.version(project)
    const nodes: Node[] = [
      new Node(project.platform?.label ?? project.platformName, {
        description: project.platform ? project.platformName : 'unknown on this host', icon: 'circuit-board',
        tooltip: project.platform ? new vscode.MarkdownString(describe(project.platform)) : 'The host does not know this platform'
      }),
      new Node(project.name, { description: version ?? 'no version', icon: 'tag' })
    ]
    if (project.metadataUri) {
      nodes.push(new Node('Metadata', { description: vscode.workspace.asRelativePath(project.metadataUri), icon: 'json', command: { title: 'Open', command: 'warpengine.editMetadata', arguments: [project.metadataUri] } }))
    }
    nodes.push(
      new Node('Play', { description: project.platform?.web.length ? 'in the web runtime' : 'the web build', icon: 'play', command: { title: 'Play', command: 'warpengine.play' } }),
      new Node('Check publish', { icon: 'checklist', command: { title: 'Check', command: 'warpengine.checkPublish' } })
    )
    if (!state?.signedIn) {
      nodes.push(new Node('Sign in', { description: hosts.current()?.name ?? 'set a host first', icon: 'sign-in', command: { title: 'Sign in', command: 'warpengine.signIn' } }))
      return nodes
    }
    if (state.error) nodes.push(new Node(state.error, { icon: 'warning' }))
    if (!state.software) {
      nodes.push(new Node('Connect', { description: 'repository, CI and catalog entry', icon: 'plug', command: { title: 'Connect', command: 'warpengine.connect' } }))
      return nodes
    }
    nodes.push(new Node('Release…', { description: 'bump, tag, push', icon: 'rocket', command: { title: 'Release', command: 'warpengine.release' } }))
    if (state.pipeline) {
      const run: PipelineRun | null = state.headRun ?? state.runs[0] ?? null
      nodes.push(new Node('Pipeline', {
        description: run ? `#${String(run.number)} ${run.status}${state.headRun ? '' : ' (not HEAD)'}` : 'no runs', icon: 'server-process',
        context: 'pipeline', data: state.pipeline, expanded: false,
        load: (): Node[] => state.runs.slice(0, 10).map((item: PipelineRun) => new Node(`#${String(item.number)} ${item.status}`, {
          description: `${item.event ?? ''} ${item.branch ?? ''} ${item.commit?.slice(0, 7) ?? ''}`.trim(),
          tooltip: item.message ?? '', icon: item.status === 'success' ? 'pass' : states.isRunning(item) ? 'sync' : 'error',
          ...(item.url ? { command: openUrl(item.url), context: 'link' } : {})
        }))
      }))
    }
    nodes.push(new Node('Releases', {
      description: String(state.releases.length), icon: 'versions', expanded: true,
      load: (): Node[] => state.releases.slice(0, 15).map((item: Release) => releaseNode(hosts, project, item))
    }))
    return nodes
  }
}

export function releaseNode(hosts: Hosts, project: Project, release: Release): Node {
  const missing: number = project.platform ? checklist(project.platform, release.assets).filter((entry) => entry.state === 'missing').length : 0
  return new Node(release.version, {
    description: `${String(release.assets.length)} assets${missing > 0 ? ` · ${String(missing)} missing` : ''}${release.commitSha ? ` · ${release.commitSha.slice(0, 7)}` : ''}`,
    icon: missing > 0 ? 'warning' : 'package', context: 'release link', data: { release, project },
    ...(hosts.current() ? { command: openUrl(hosts.client().playUrl(project.name, release.version)) } : {}),
    load: (): Node[] => [
      ...(project.platform ? checklist(project.platform, release.assets).map((entry) => new Node(`${checklistMark(entry.state)} ${entry.kind}`, { description: entry.note })) : []),
      ...release.assets.map((asset: ReleaseAsset) => new Node(asset.kind, { description: asset.path.split('/').pop() ?? '', icon: 'file-binary' }))
    ]
  })
}
