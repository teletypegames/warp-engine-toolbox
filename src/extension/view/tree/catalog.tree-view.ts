/**
 * The catalog view: the host's softwares, their releases, images and links, and the pipelines.
 *
 * @packageDocumentation
 */

import type { ExternalLink, Release, Software, SoftwareField } from '../../../domain/model/catalog.model'
import type { Host } from '../../../domain/model/host.model'
import type { SoftwareImage } from '../../../domain/model/image.model'
import type { Pipeline } from '../../../domain/model/pipeline.model'
import type { Platform } from '../../../domain/model/platform.model'
import type { CatalogOverview, CatalogService } from '../../../domain/service/catalog.service'
import type { HostService } from '../../../domain/service/host.service'
import type { ImageService } from '../../../domain/service/image.service'
import type { PlatformService } from '../../../domain/service/platform.service'
import type { PlayService } from '../../../domain/service/play.service'
import { Dialogs } from '../../ui/dialogs'
import type { ProjectRegistry } from '../../workspace/project.registry'
import { t } from '../../ui/l10n'
import { ReleaseNode } from './release.node'
import { TreeNode } from './tree.node'
import type { TreeView } from './tree.provider'

/** The data of a software field node, for `warpengine.editSoftwareField`. */
export interface FieldData {
  /** The software. */
  readonly software: Software
  /** The field to change. */
  readonly field: SoftwareField
}

/** The data of an image node, for the gallery commands. */
export interface ImageData {
  /** The software the image belongs to. */
  readonly software: Software
  /** The image. */
  readonly image: SoftwareImage
}

/** What {@link CatalogTreeView} reads. */
export interface CatalogTreeDependencies {
  /** The current host. */
  readonly hosts: HostService
  /** The host's catalog. */
  readonly catalog: CatalogService
  /** The platform labels. */
  readonly platforms: PlatformService
  /** The play links of the releases. */
  readonly play: PlayService
  /** The image galleries. */
  readonly images: ImageService
  /** The current project, whose software is shown first. */
  readonly projects: ProjectRegistry
}

/**
 * The content of the catalog view (`warpengine.catalog`): the host and the signed-in principal, the current project's
 * software (expanded), the softwares by platform with their fields, releases (with the asset checklist), images and links,
 * and the pipelines.
 */
export class CatalogTreeView implements TreeView {
  private readonly hosts: HostService
  private readonly catalog: CatalogService
  private readonly platforms: PlatformService
  private readonly play: PlayService
  private readonly images: ImageService
  private readonly projects: ProjectRegistry

  /**
   * Creates the view.
   *
   * @param deps - What it reads.
   */
  public constructor(deps: CatalogTreeDependencies) {
    this.hosts = deps.hosts
    this.catalog = deps.catalog
    this.platforms = deps.platforms
    this.play = deps.play
    this.images = deps.images
    this.projects = deps.projects
  }

  /**
   * Returns the host, the current project's software (when it is in the catalog), the softwares and the pipelines nodes;
   * sets the `warpengine.signedIn` context key.
   *
   * @returns The root nodes; none without a host or a sign-in.
   */
  public async roots(): Promise<TreeNode[]> {
    const host: Host | null = this.hosts.current()
    if (!host) return []
    const signedIn: boolean = await this.catalog.isSignedIn()
    await Dialogs.setContext('warpengine.signedIn', signedIn)
    const overview: CatalogOverview | null = signedIn ? await this.catalog.overview() : null
    if (!overview) return []
    const described: Platform[] = await this.platforms.all().catch((): Platform[] => [])
    return [this.hostNode(host, overview), ...this.projectNode(overview, described), this.softwaresNode(overview, described), this.pipelinesNode()]
  }

  private projectNode(overview: CatalogOverview, described: readonly Platform[]): TreeNode[] {
    const name: string | undefined = this.projects.current()?.name
    const software: Software | undefined = overview.softwares.find((item: Software) => item.name === name)
    if (!software) return []
    const platform: Platform | null = described.find((item: Platform) => item.name === software.platform) ?? null
    return [this.softwareNode(software, platform, true)]
  }

  private hostNode(host: Host, overview: CatalogOverview): TreeNode {
    return new TreeNode(host.name, {
      description: overview.principal?.label ?? '', icon: 'server',
      tooltip: `${host.url}\n${(overview.principal?.scopes ?? []).join(', ')}`, command: TreeNode.openUrl(host.url), context: 'link'
    })
  }

  private softwaresNode(overview: CatalogOverview, described: readonly Platform[]): TreeNode {
    const groups: [string, readonly Software[]][] = [...overview.byPlatform.entries()].sort(([a], [b]) => a.localeCompare(b))
    return new TreeNode(t('Softwares'), {
      description: String(overview.softwares.length), icon: 'library', expanded: true,
      load: (): TreeNode[] => groups.map(([name, softwares]) => {
        const platform: Platform | null = described.find((item: Platform) => item.name === name) ?? null
        return new TreeNode(platform?.label ?? name, { description: String(softwares.length), icon: 'circuit-board', load: (): TreeNode[] => softwares.map((software: Software) => this.softwareNode(software, platform)) })
      })
    })
  }

  private pipelinesNode(): TreeNode {
    return new TreeNode(t('Pipelines'), {
      icon: 'server-process',
      load: async (): Promise<TreeNode[]> => (await this.catalog.pipelines()).map((pipeline: Pipeline) => new TreeNode(`${pipeline.repoOwner}/${pipeline.repoName}`, {
        description: `${pipeline.platform}${pipeline.active ? '' : ` · ${t('inactive')}`}`, icon: pipeline.active ? 'server-process' : 'circle-slash',
        context: 'pipeline', data: pipeline
      }))
    })
  }

  private softwareNode(software: Software, platform: Platform | null, current: boolean = false): TreeNode {
    const description = `${software.name} · ${software.status ?? t('no status')}`
    return new TreeNode(software.title, {
      description: current ? `${description} · ${t('this project')}` : description, icon: current ? 'star-full' : 'game',
      context: 'software', data: software, expanded: current,
      load: (): TreeNode[] => [...CatalogTreeView.fields(software), this.releasesNode(software, platform), this.imagesNode(software), this.linksNode(software)]
    })
  }

  private releasesNode(software: Software, platform: Platform | null): TreeNode {
    return new TreeNode(t('Releases'), {
      icon: 'versions',
      load: async (): Promise<TreeNode[]> => (await this.catalog.releases(software)).map((release: Release) =>
        ReleaseNode.create({ release, name: software.name, platform }, this.play.playUrl(software.name, release.version)))
    })
  }

  private imagesNode(software: Software): TreeNode {
    return new TreeNode(t('Images'), {
      icon: 'file-media', context: 'images', data: software,
      load: async (): Promise<TreeNode[]> => {
        const base: string = this.hosts.current()?.url ?? ''
        return (await this.images.images(software)).map((image: SoftwareImage, index: number) => new TreeNode(`#${String(index + 1)}`, {
          description: [image.isDefault ? t('default') : '', image.origin === 'sync' ? t('by sync') : ''].filter(Boolean).join(' · '),
          icon: image.isDefault ? 'star-full' : 'file-media', context: 'image link', data: { software, image } satisfies ImageData,
          command: image.url ? TreeNode.openUrl(`${base}${image.url}`) : undefined
        }))
      }
    })
  }

  private linksNode(software: Software): TreeNode {
    return new TreeNode(t('Links'), {
      icon: 'link',
      load: async (): Promise<TreeNode[]> => (await this.catalog.links(software)).map((link: ExternalLink) =>
        new TreeNode(link.label, { description: link.url, icon: 'link-external', command: TreeNode.openUrl(link.url), context: 'link' }))
    })
  }

  private static fields(software: Software): TreeNode[] {
    const values: [SoftwareField, string][] = [
      ['title', software.title], ['status', software.status ?? '—'], ['category', software.category ?? '—'],
      ['highlighted', software.highlighted ? t('yes') : t('no')]
    ]
    return values.map(([field, value]) => new TreeNode(field, { description: value, icon: 'symbol-field', context: 'field', data: { software, field } satisfies FieldData }))
  }
}
