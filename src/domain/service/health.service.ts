/**
 * Gathers the facts of the Health view: the host, the local engine's containers, the project's metadata check.
 *
 * @module
 */
import type { Principal } from '../model/catalog.model'
import { HealthChecks, type HealthSection, type HostFacts } from '../model/health.model'
import { HostError } from '../model/host-error.model'
import type { Host } from '../model/host.model'
import type { WellKnown } from '../model/local-engine.model'
import type { Project } from '../model/project.model'
import type { PublishCheck } from '../model/publish-check.model'
import type { RemoteState } from '../model/remote-state.model'
import type { ServerContainer } from '../model/server.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { AdminRepositories } from '../repository/warp-engine.gateway'
import type { ConnectionService } from './connection.service'
import type { HostInfoService } from './host-info.service'
import type { HostService } from './host.service'
import type { LocalEngineService } from './local-engine.service'
import type { PublishCheckService } from './publish-check.service'
import type { ServerService } from './server.service'

/** What {@link HealthService} asks. */
export interface HealthDependencies {
  /** The current host. */
  readonly hosts: HostService
  /** What the host says about itself, and the software's admin page. */
  readonly hostInfo: HostInfoService
  /** The session and the admin API. */
  readonly connection: ConnectionService
  /** Whether the current host is the local engine. */
  readonly local: LocalEngineService
  /** The local containers. */
  readonly servers: ServerService
  /** The host's publish check. */
  readonly publishCheck: PublishCheckService
  /** Reads the metadata file. */
  readonly files: FileSystemRepository
}

/** Checks what is set up and what is not, without asking the user anything. */
export class HealthService {
  /**
   * Creates the service.
   *
   * @param deps - What it asks.
   */
  public constructor(private readonly deps: HealthDependencies) {}

  /**
   * Checks the host, the local engine (when there is one or it is the host) and the project. Asks the host about
   * itself and the token's owner (HTTP), Docker for the containers, and the host's publish check for the metadata.
   *
   * @param project - The current project, or `null`.
   * @param state - The project's remote state, or `null`.
   * @returns The sections, in the order to show them.
   */
  public async sections(project: Project | null, state: RemoteState | null): Promise<HealthSection[]> {
    const isCurrentHost: boolean = this.deps.local.isCurrentHost()
    const host: HostFacts = await this.host()
    const containers: ServerContainer[] | null = await this.deps.servers.containers().catch((): null => null)
    const local: HealthSection | null = HealthChecks.local({ isCurrentHost, containers })
    const check: PublishCheck | null = host.host && project ? await this.check(project) : null
    const adminUrl: string | null = state?.software ? await this.deps.hostInfo.adminUrl(state.software).catch((): null => null) : null
    const projectSection: HealthSection = HealthChecks.project({ project, check, state, local: isCurrentHost, adminUrl })
    return [HealthChecks.host(host), ...(local ? [local] : []), projectSection]
  }

  private async host(): Promise<HostFacts> {
    const host: Host | null = this.deps.hosts.current()
    if (!host) return { host, info: null, signedIn: false, principal: null, refused: false }
    const info: WellKnown | null = await this.deps.hostInfo.wellKnown(host.url)
    const admin: AdminRepositories | null = await this.deps.connection.admin(false).catch((): null => null)
    if (!admin) return { host, info, signedIn: false, principal: null, refused: false }
    try {
      const principal: Principal = await admin.catalog.me()
      return { host, info, signedIn: true, principal, refused: false }
    } catch (error: unknown) {
      return { host, info, signedIn: true, principal: null, refused: HostError.isUnauthorized(error) }
    }
  }

  private async check(project: Project): Promise<PublishCheck | null> {
    if (!project.metadataPath || !project.platform) return null
    const text: string | null = await this.deps.files.readText(project.metadataPath)
    return text === null ? null : this.deps.publishCheck.check(project, text).catch((): null => null)
  }
}
