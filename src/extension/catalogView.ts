import * as vscode from 'vscode'
import type { ExternalLink, Pipeline, PlatformDescription, Principal, Release, Software } from '../domain/types'
import type { WarpEngineClient } from '../infrastructure/warpEngineClient'
import type { WarpEngineAuth } from './auth'
import type { Hosts } from './hosts'
import type { Platforms } from './platforms'
import { releaseNode } from './projectView'
import type { Project } from './project'
import { Node, openUrl } from './tree'

export interface FieldData {
  readonly software: Software
  readonly field: 'status' | 'category' | 'highlighted' | 'title'
}

export function catalogRoots(hosts: Hosts, auth: WarpEngineAuth, platforms: Platforms): () => Promise<Node[]> {
  return async (): Promise<Node[]> => {
    const host = hosts.current()
    if (!host) return []
    const client: WarpEngineClient | null = await auth.client(false)
    await vscode.commands.executeCommand('setContext', 'warpengine.signedIn', client !== null)
    if (!client) return []
    const me: Principal | null = await client.me().catch(() => null)
    const all: Software[] = await client.softwares()
    const byPlatform = new Map<string, Software[]>()
    for (const software of all) byPlatform.set(software.platform, [...(byPlatform.get(software.platform) ?? []), software])
    const described: PlatformDescription[] = await platforms.all().catch((): PlatformDescription[] => [])
    return [
      new Node(host.name, { description: me?.label ?? '', icon: 'server', tooltip: `${host.url}\n${(me?.scopes ?? []).join(', ')}`, command: openUrl(host.url), context: 'link' }),
      new Node('Softwares', {
        description: String(all.length), icon: 'library', expanded: true,
        load: (): Node[] => [...byPlatform.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([platform, softwares]) => new Node(
          described.find((item: PlatformDescription) => item.name === platform)?.label ?? platform,
          { description: String(softwares.length), icon: 'circuit-board', load: (): Node[] => softwares.map((software: Software) => softwareNode(hosts, client, software, described)) }
        ))
      }),
      new Node('Pipelines', {
        icon: 'server-process',
        load: async (): Promise<Node[]> => (await client.pipelines()).map((pipeline: Pipeline) => new Node(`${pipeline.repoOwner}/${pipeline.repoName}`, {
          description: `${pipeline.platform}${pipeline.active ? '' : ' · inactive'}`, icon: pipeline.active ? 'server-process' : 'circle-slash',
          context: 'pipeline', data: pipeline
        }))
      })
    ]
  }
}

function softwareNode(hosts: Hosts, client: WarpEngineClient, software: Software, described: PlatformDescription[]): Node {
  const platform: PlatformDescription | null = described.find((item: PlatformDescription) => item.name === software.platform) ?? null
  const project: Project = { name: software.name, platform, platformName: software.platform } as unknown as Project
  return new Node(software.title, {
    description: `${software.name} · ${software.status ?? 'no status'}`, icon: 'game', context: 'software', data: software,
    load: (): Node[] => [
      field(software, 'title', software.title),
      field(software, 'status', software.status ?? '—'),
      field(software, 'category', software.category ?? '—'),
      field(software, 'highlighted', software.highlighted ? 'yes' : 'no'),
      new Node('Releases', { icon: 'versions', load: async (): Promise<Node[]> => (await client.releases(software.id)).map((release: Release) => releaseNode(hosts, project, release)) }),
      new Node('Links', {
        icon: 'link', load: async (): Promise<Node[]> => (await client.externalLinks(software.id)).map((link: ExternalLink) => new Node(link.label, { description: link.url, icon: 'link-external', command: openUrl(link.url), context: 'link' }))
      })
    ]
  })
}

function field(software: Software, name: FieldData['field'], value: string): Node {
  const data: FieldData = { software, field: name }
  return new Node(name, { description: value, icon: 'symbol-field', context: 'field', data })
}
