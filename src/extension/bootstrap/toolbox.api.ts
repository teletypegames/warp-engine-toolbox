import type { Platform } from '../../domain/model/platform.model'
import type { Host } from '../../domain/model/host.model'
import type { ScaffoldService } from '../../domain/service/scaffold.service'
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
  readonly hosts: { require(): Host }
  readonly auth: WarpEngineAuthProvider
  readonly scaffold: ScaffoldService
}
