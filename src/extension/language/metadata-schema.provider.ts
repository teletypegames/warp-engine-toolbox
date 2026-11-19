/**
 * The JSON schema of `metadata.json`, served from the host as a virtual document.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import type { ConnectionService } from '../../domain/service/connection.service'
import type { HostService } from '../../domain/service/host.service'
import type { ProjectRegistry } from '../workspace/project.registry'

/** The URI scheme of the schema documents, `warpengine-schema`; `package.json` maps `metadata.json` to `warpengine-schema://current/metadata.schema.json`. */
export const SCHEMA_SCHEME = 'warpengine-schema'
const CURRENT = `${SCHEMA_SCHEME}://current/metadata.schema.json`
const EMPTY: string = JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' })

/**
 * Serves the metadata schema of the current project's platform as the `warpengine-schema:`
 * document, so the JSON language service validates and completes `metadata.json`.
 *
 * Schemas are fetched from the host's build API and cached per host and platform; an
 * open-ended object schema stands in when there is no host or the request fails.
 */
export class MetadataSchemaProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly changed: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>()
  /** Fires with the schema URI when its content may have changed, so VS Code reloads it. */
  public readonly onDidChange: vscode.Event<vscode.Uri> = this.changed.event
  private readonly cache: Map<string, string> = new Map<string, string>()
  private readonly registration: vscode.Disposable = vscode.workspace.registerTextDocumentContentProvider(SCHEMA_SCHEME, this)

  /**
   * Creates the provider; the `warpengine-schema` scheme is registered as the object is created.
   *
   * @param hosts - Tells the current host.
   * @param connection - Opens the host's build API.
   * @param projects - Tells the current project and its platform.
   */
  public constructor(private readonly hosts: HostService, private readonly connection: ConnectionService, private readonly projects: ProjectRegistry) {}

  /**
   * Provides the schema of the current project's platform.
   *
   * @returns The schema as JSON text; the open-ended schema when there is no current project or platform.
   */
  public async provideTextDocumentContent(): Promise<string> {
    const platform: string | undefined = this.projects.current()?.platformName
    return platform ? this.schema(platform) : EMPTY
  }

  /**
   * Fetches a platform's metadata schema from the current host, or from the cache.
   *
   * @param platform - The platform name.
   * @returns The schema as JSON text; the open-ended schema when no host is set or the request fails (not cached then).
   */
  public async schema(platform: string): Promise<string> {
    const host: Host | null = this.hosts.current()
    if (!host) return EMPTY
    const key = `${host.url}#${platform}`
    const cached: string | undefined = this.cache.get(key)
    if (cached) return cached
    try {
      const text: string = JSON.stringify(await this.connection.build().metadataSchema(platform))
      this.cache.set(key, text)
      return text
    } catch {
      return EMPTY
    }
  }

  /** Tells VS Code the schema changed, such as after the current project changed. */
  public announce(): void {
    this.changed.fire(vscode.Uri.parse(CURRENT))
  }

  /** Empties the cache and announces the change, after the current host changed. */
  public forgetHost(): void {
    this.cache.clear()
    this.announce()
  }

  /** Unregisters the scheme and releases the event emitter. */
  public dispose(): void {
    this.registration.dispose()
    this.changed.dispose()
  }
}
