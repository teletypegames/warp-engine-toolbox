/**
 * Running a local build in the host's player: Play.
 *
 * @module
 */
import { FilePath } from '../model/path.model'
import type { WebBindingDescription } from '../model/platform-description.model'
import type { Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { ConnectionService } from './connection.service'

/** How a project is played: which player binding, which payload to look for, and which Makefile target builds it. */
export interface PlayPlan {
  /** The platform's default web binding, or `null` when it has none. */
  readonly binding: WebBindingDescription | null
  /** What the player loads: `html` for a web build, else a platform payload kind. */
  readonly payloadKind: string
  /** The Makefile target that builds the payload, or `null` when the Makefile has none of the expected ones. */
  readonly target: string | null
}

const HTML = 'html'
const HTML_TARGETS: readonly string[] = ['web', 'html', 'build']
const EXCLUDE = '{**/node_modules/**,**/.git/**,**/.godot/**,**/target/**}'
const SEARCH_LIMIT = 200
const BUILD_FOLDER = /(^|[\\/])(dist|build|export|web|html|out|public)[\\/]/

/** Finds a project's built payload and gives the player URLs and pages of the current host. */
export class PlayService {
  /**
   * Creates the service.
   *
   * @param files - Searches and reads the project's files.
   * @param connection - Gives the build API of the current host.
   */
  public constructor(private readonly files: FileSystemRepository, private readonly connection: ConnectionService) {}

  /**
   * Decides how to play a project.
   *
   * @param project - The project.
   * @param targets - The targets of its Makefile.
   * @returns The plan.
   */
  public plan(project: Project, targets: readonly string[]): PlayPlan {
    const binding: WebBindingDescription | null = project.platform?.defaultBinding() ?? null
    const payloadKind: string = binding?.payload ?? HTML
    const candidates: readonly string[] = payloadKind === HTML ? HTML_TARGETS : ['build']
    return { binding, payloadKind, target: candidates.find((name: string) => targets.includes(name)) ?? null }
  }

  /**
   * Finds the built payload in the project folder: for `html` the newest `index.html`, preferring build folders; otherwise the file named after the project with the payload's extension, else the newest such file.
   *
   * @param project - The project.
   * @param kind - The payload kind from {@link PlayPlan.payloadKind}.
   * @returns The absolute path, or `null` when nothing is found.
   */
  public async findPayload(project: Project, kind: string): Promise<string | null> {
    return kind === HTML ? this.findHtml(project) : this.findBuild(project, kind)
  }

  /**
   * Builds the URL of the host's player page for the project, from the `web` part of its metadata; makes no request.
   *
   * @param project - The project.
   * @returns The URL.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set.
   */
  public previewUrl(project: Project): string {
    const web = project.metadata.object('web')
    return this.connection.build().playPreviewUrl({
      platform: project.platformName,
      title: project.metadata.text('title') ?? project.name,
      params: web['params'] ?? null,
      start: typeof web['start'] === 'string' ? web['start'] : null,
      binding: typeof web['runtime'] === 'string' ? web['runtime'] : null
    })
  }

  /**
   * Builds the URL of the host's player page for a published release.
   *
   * @param name - The software name.
   * @param version - The release version.
   * @returns The URL, or `null` when no host is set.
   */
  public playUrl(name: string, version: string): string | null {
    return this.connection.hasHost() ? this.connection.build().playUrl(name, version) : null
  }

  /**
   * Downloads a page of the current host.
   *
   * @param url - The absolute URL.
   * @returns The page's HTML.
   * @throws {@link "domain/model/message.model".DomainError} When no host is set or the host answers with an error.
   */
  public async hostPage(url: string): Promise<string> {
    return this.connection.build().page(url)
  }

  /**
   * Reads the bytes of a payload file.
   *
   * @param path - The absolute path.
   * @returns The content.
   */
  public async payload(path: string): Promise<Uint8Array> {
    return this.files.readBytes(path)
  }

  private async findBuild(project: Project, kind: string): Promise<string | null> {
    const extension: string | null = project.platform?.payloadExtension(kind) ?? null
    if (!extension) return null
    const found: string[] = await this.search(project, `**/*${extension}`)
    const own: string | undefined = found.find((path: string) => FilePath.basename(path) === `${project.name}${extension}`)
    return own ?? this.newest(found)
  }

  private async findHtml(project: Project): Promise<string | null> {
    const found: string[] = await this.search(project, '**/index.html')
    const built: string[] = found.filter((path: string) => BUILD_FOLDER.test(FilePath.relative(project.folder, path)))
    return this.newest(built.length > 0 ? built : found)
  }

  private async search(project: Project, include: string): Promise<string[]> {
    return this.files.find({ folder: project.folder, include, exclude: EXCLUDE, limit: SEARCH_LIMIT })
  }

  private async newest(paths: readonly string[]): Promise<string | null> {
    let best: { path: string; time: number } | null = null
    for (const path of paths) {
      const time: number = await this.files.modifiedAt(path)
      if (!best || time > best.time) best = { path, time }
    }
    return best?.path ?? null
  }
}
