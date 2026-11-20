/**
 * What the Dashboard shows, gathered from the same stores and services the sidebar views read.
 *
 * @packageDocumentation
 */

import { Releases, type Release } from '../../../domain/model/catalog.model'
import type { HealthSection } from '../../../domain/model/health.model'
import type { Host } from '../../../domain/model/host.model'
import type { PipelineRun } from '../../../domain/model/pipeline.model'
import type { Project } from '../../../domain/model/project.model'
import type { RemoteState } from '../../../domain/model/remote-state.model'
import type { ServerContainer } from '../../../domain/model/server.model'
import type { SyncLink } from '../../../domain/model/sync.model'
import type { CatalogOverview, CatalogService } from '../../../domain/service/catalog.service'
import type { HealthService } from '../../../domain/service/health.service'
import type { HostService } from '../../../domain/service/host.service'
import type { LocalEngineService } from '../../../domain/service/local-engine.service'
import type { PlayService } from '../../../domain/service/play.service'
import type { PlatformService } from '../../../domain/service/platform.service'
import type { ServerService } from '../../../domain/service/server.service'
import type { SyncService } from '../../../domain/service/sync.service'
import type { ProjectRegistry } from '../../workspace/project.registry'
import type { RemoteStateStore } from '../../workspace/remote-state.store'

const RUN_LIMIT = 10
const RELEASE_LIMIT = 15

/** The current project as the Dashboard heads it. */
export interface DashboardProject {
  /** The game's title. */
  readonly title: string
  /** The software name. */
  readonly name: string
  /** The platform's label. */
  readonly platform: string
  /** The local version, or `null` when it cannot be read. */
  readonly version: string | null
  /** The checked-out branch, or `null`. */
  readonly branch: string | null
}

/** A release row with its play link. */
export interface DashboardRelease {
  /** The release. */
  readonly release: Release
  /** Where it plays on the web, or `null`. */
  readonly playUrl: string | null
}

/** A platform row of the catalog summary. */
export interface DashboardPlatform {
  /** The platform's label. */
  readonly label: string
  /** How many softwares it has. */
  readonly count: number
}

/** The catalog summary. */
export interface DashboardCatalog {
  /** Who is signed in, or `null`. */
  readonly principal: string | null
  /** How many softwares the catalog has. */
  readonly total: number
  /** The softwares per platform, the biggest first. */
  readonly platforms: readonly DashboardPlatform[]
}

/** Everything the Dashboard page shows; `null` parts are left out. */
export interface DashboardData {
  /** The current host, or `null`. */
  readonly host: Host | null
  /** The current project, or `null`. */
  readonly project: DashboardProject | null
  /** The Health view's groups. */
  readonly health: readonly HealthSection[]
  /** The project's latest pipeline runs, newest first. */
  readonly runs: readonly PipelineRun[]
  /** The commit checked out, to mark its run. */
  readonly head: string | null
  /** The project's listed releases, newest first. */
  readonly releases: readonly DashboardRelease[]
  /** The development build of the current side branch, or `null`. */
  readonly branchBuild: DashboardRelease | null
  /** The catalog summary, or `null` when not signed in. */
  readonly catalog: DashboardCatalog | null
  /** The local containers, or `null` when Docker could not be asked. */
  readonly containers: readonly ServerContainer[] | null
  /** The sync partners, or `null` when there is no local engine. */
  readonly sync: readonly SyncLink[] | null
}

/** What {@link DashboardCollector} reads. */
export interface DashboardSources {
  /** The current host. */
  readonly hosts: HostService
  /** The workspace's projects. */
  readonly projects: ProjectRegistry
  /** The current project's remote state. */
  readonly states: RemoteStateStore
  /** The Health checks. */
  readonly health: HealthService
  /** The catalog overview. */
  readonly catalog: CatalogService
  /** The platform labels. */
  readonly platforms: PlatformService
  /** The play links. */
  readonly play: PlayService
  /** The local containers. */
  readonly servers: ServerService
  /** The local engine, whose sync partners are listed. */
  readonly local: LocalEngineService
  /** The sync partners. */
  readonly sync: SyncService
}

/** Gathers the {@link DashboardData}; each part that fails is left empty instead of failing the page. */
export class DashboardCollector {
  /**
   * Creates the collector.
   *
   * @param sources - What it reads.
   */
  public constructor(private readonly sources: DashboardSources) {}

  /**
   * Reads everything the Dashboard shows: the stored remote state, and the host (HTTP), Docker and the publish check
   * through the Health checks, the catalog overview and the sync partners.
   *
   * @returns The data.
   */
  public async collect(): Promise<DashboardData> {
    const project: Project | null = this.sources.projects.current()
    const state: RemoteState | null = this.sources.states.current()
    const [health, catalog, containers, sync] = await Promise.all([
      this.sources.health.sections(project, state).catch((): HealthSection[] => []),
      this.catalog(), this.sources.servers.containers().catch((): null => null), this.syncLinks()
    ])
    return { host: this.sources.hosts.current(), health, catalog, containers, sync, ...(await this.projectPart(project, state)) }
  }

  private async projectPart(project: Project | null, state: RemoteState | null): Promise<Pick<DashboardData, 'project' | 'runs' | 'head' | 'releases' | 'branchBuild'>> {
    const empty: Pick<DashboardData, 'runs' | 'head' | 'releases' | 'branchBuild'> = { runs: [], head: null, releases: [], branchBuild: null }
    if (!project) return { project: null, ...empty }
    const head: DashboardProject = await this.project(project, state)
    if (!state) return { project: head, ...empty }
    return {
      project: head, runs: state.runs.slice(0, RUN_LIMIT), head: state.head,
      releases: Releases.listed(state.releases).slice(0, RELEASE_LIMIT).map((release: Release) => this.release(project, release)),
      branchBuild: state.branchBuild ? this.release(project, state.branchBuild) : null
    }
  }

  private async project(project: Project, state: RemoteState | null): Promise<DashboardProject> {
    return { title: project.title, name: project.name, platform: project.platformLabel, version: await this.sources.projects.version(project), branch: state?.branch ?? null }
  }

  private release(project: Project, release: Release): DashboardRelease {
    return { release, playUrl: this.sources.play.playUrl(project.name, release.version) }
  }

  private async catalog(): Promise<DashboardCatalog | null> {
    const overview: CatalogOverview | null = await this.sources.catalog.overview().catch((): null => null)
    if (!overview) return null
    const labels: Map<string, string> = new Map<string, string>((await this.sources.platforms.all().catch(() => [])).map((platform) => [platform.name, platform.label]))
    const platforms: DashboardPlatform[] = [...overview.byPlatform.entries()]
      .map(([name, softwares]) => ({ label: labels.get(name) ?? name, count: softwares.length }))
      .sort((a: DashboardPlatform, b: DashboardPlatform) => b.count - a.count || a.label.localeCompare(b.label))
    return { principal: overview.principal?.label ?? null, total: overview.softwares.length, platforms }
  }

  private async syncLinks(): Promise<SyncLink[] | null> {
    if (!this.sources.local.current()) return null
    return this.sources.sync.links().catch((): SyncLink[] => [])
  }
}
