import type { Platform } from '../../domain/model/platform.model'
import type { Host } from '../../domain/model/host.model'
import type { LocalCiService } from '../../domain/service/local-ci.service'
import type { ScaffoldService } from '../../domain/service/scaffold.service'
import type { SignInService } from '../../domain/service/sign-in.service'
import type { SyncService } from '../../domain/service/sync.service'
import type { WarpEngineAuthProvider } from '../auth/warp-engine.auth-provider'
import type { MetadataSchemaProvider } from '../language/metadata-schema.provider'
import type { PublishDiagnostics } from '../view/diagnostics/publish.diagnostics'
import type { PlayPanel } from '../view/play/play.panel'
import type { ProjectRegistry } from '../workspace/project.registry'

export interface ToolboxApi {
  readonly projects: ProjectRegistry
  readonly platforms: { find(name: string | null): Promise<Platform | null> }
  readonly schemas: MetadataSchemaProvider
  readonly diagnostics: PublishDiagnostics
  readonly player: PlayPanel
  readonly hosts: { require(): Host; current(): Host | null; remember(url: string): Promise<Host> }
  readonly auth: WarpEngineAuthProvider
  readonly scaffold: ScaffoldService
  readonly sync: SyncService
  readonly signIn: SignInService
  readonly localCi: LocalCiService
}
