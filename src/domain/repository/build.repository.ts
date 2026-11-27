/**
 * Port to the public build API of a WarpEngine host, and the requests it takes.
 *
 * @module
 */
import type { Category } from '../model/catalog.model'
import type { PlatformDescription } from '../model/platform-description.model'
import type { PublishCheck } from '../model/publish-check.model'
import type { MetadataValues } from '../model/metadata.model'

/** What {@link BuildRepository.check} sends to the host: a project's platform, metadata and version to dry-run a publish. */
export interface PublishCheckRequest {
  /** The platform id the project builds for, e.g. `tic80`. */
  readonly platform: string
  /** The project's metadata values as `metadata.json` holds them. */
  readonly metadata: MetadataValues
  /** The version about to be released, or `null` to check without one. */
  readonly version: string | null
}

/** What {@link BuildRepository.playPreviewUrl} encodes: a local build to run in the host's player page. */
export interface PlayPreviewRequest {
  /** The platform id whose player runs the build. */
  readonly platform: string
  /** The title shown on the player page; empty leaves the host's default. */
  readonly title: string
  /** Extra player parameters, sent as JSON; `undefined` or `null` sends none. */
  readonly params: unknown
  /** The file or command the player starts, or `null` for the platform default. */
  readonly start: string | null
  /** The runtime binding (player variant) to use, or `null` for the platform default. */
  readonly binding: string | null
  /** The project's catalog category (`game`, `tool`…), which picks the player's input mode; `null` leaves the host's default. */
  readonly category: string | null
}

/**
 * Port to the public build API of a WarpEngine host: platforms, categories, schemas, the CI
 * configuration preview, the publish check and the player pages. Needs no admin token.
 *
 * Every asynchronous member rejects with a host error (status `0` when the host cannot be
 * reached) when the host answers with an error.
 */
export interface BuildRepository {
  /**
   * Lists the platforms the host can build and publish.
   *
   * @returns The host's platform descriptions.
   */
  platforms(): Promise<PlatformDescription[]>
  /**
   * Lists the software categories of the host's vocabulary.
   *
   * @returns The categories; empty when the host defines none.
   */
  categories(): Promise<Category[]>
  /**
   * Fetches the JSON schema of `metadata.json` for one platform.
   *
   * @param platform - The platform id.
   * @returns The schema as the host sends it.
   */
  metadataSchema(platform: string): Promise<unknown>
  /**
   * Fetches the CI pipeline configuration the host would generate for a project.
   *
   * @param platform - The platform id.
   * @param name - The software name, or `null` to preview without one.
   * @returns The pipeline configuration as YAML text.
   */
  pipelinePreview(platform: string, name: string | null): Promise<string>
  /**
   * Asks the host what it would refuse if the project were published now.
   *
   * @param request - The platform, metadata and version to check.
   * @returns The host's verdict with its problems.
   */
  check(request: PublishCheckRequest): Promise<PublishCheck>
  /**
   * Builds the URL of the host's player page for a local build; makes no request.
   *
   * @param request - The platform, title, parameters, start file and binding.
   * @returns The absolute play-preview URL on the host.
   */
  playPreviewUrl(request: PlayPreviewRequest): string
  /**
   * Downloads a page of the host, typically the one {@link BuildRepository.playPreviewUrl} built.
   *
   * @param url - The absolute URL to fetch.
   * @returns The page's HTML.
   * @throws {@link "domain/model/message.model".DomainError} When the host answers with an error status.
   */
  page(url: string): Promise<string>
  /**
   * Builds the URL of the host's player page for a published release; makes no request.
   *
   * @param name - The software name.
   * @param version - The release version.
   * @returns The absolute play URL on the host.
   */
  playUrl(name: string, version: string): string
}
