/**
 * What `activate` returns: the objects the integration tests reach.
 *
 * @packageDocumentation
 */

import type { Platform } from '../../domain/model/platform.model'
import type { Host } from '../../domain/model/host.model'
import type { ServerService } from '../../domain/service/server.service'
import type { LocalCiService } from '../../domain/service/local-ci.service'
import type { ScaffoldService } from '../../domain/service/scaffold.service'
import type { SignInService } from '../../domain/service/sign-in.service'
import type { SyncService } from '../../domain/service/sync.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import type { MetadataSchemaProvider } from '../language/metadata-schema.provider'
import type { PublishDiagnostics } from '../view/diagnostics/publish.diagnostics'
import type { PlayPanel } from '../view/play/play.panel'
import type { ProjectRegistry } from '../workspace/project.registry'

/** The objects of a running toolbox that `activate` returns for the integration tests. */
export interface ToolboxApi {
  /** The projects of the workspace folders and the current one. */
  readonly projects: ProjectRegistry
  /** Looks up the host's description of a platform by name. */
  readonly platforms: {
    /**
     * Finds the host's description of a platform.
     *
     * @param name - The platform name; `null` finds nothing.
     * @returns The platform, or `null` when the host does not know it.
     */
    find(name: string | null): Promise<Platform | null>
  }
  /** The metadata JSON schemas served from the host's platform descriptions. */
  readonly schemas: MetadataSchemaProvider
  /** The publish check problems shown on the metadata file. */
  readonly diagnostics: PublishDiagnostics
  /** The Play panel. */
  readonly player: PlayPanel
  /** The configured hosts: the current one, the one required for a flow, and remembering a new address. */
  readonly hosts: {
    /**
     * Returns the current host.
     *
     * @throws {@link "domain/model/message.model".DomainError} When no host is set.
     */
    require(): Host
    /** Returns the current host, or `null` when none is set. */
    current(): Host | null
    /**
     * Adds an address to the known hosts in the settings, without making it current.
     *
     * @param url - The address of the host.
     * @returns The remembered host.
     */
    remember(url: string): Promise<Host>
  }
  /** The VS Code authentication provider of the WarpEngine hosts. */
  readonly auth: WarpEngineAuthProvider
  /** New games and WarpEngine added to a project. */
  readonly scaffold: ScaffoldService
  /** Pairing the local engine with another WarpEngine instance. */
  readonly sync: SyncService
  /** Signing in to a host. */
  readonly signIn: SignInService
  /** Setting a project up on the local engine's CI. */
  readonly localCi: LocalCiService
  /** The WarpEngine containers on this machine. */
  readonly servers: ServerService
}
