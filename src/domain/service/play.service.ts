import { FilePath } from '../model/path.model'
import type { WebBindingDescription } from '../model/platform-description.model'
import type { Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { ConnectionService } from './connection.service'

export interface PlayPlan {
  readonly binding: WebBindingDescription | null
  readonly payloadKind: string
  readonly target: string | null
}

const HTML = 'html'
const HTML_TARGETS: readonly string[] = ['web', 'html', 'build']
const EXCLUDE = '{**/node_modules/**,**/.git/**,**/.godot/**,**/target/**}'
const SEARCH_LIMIT = 200
const BUILD_FOLDER = /(^|[\\/])(dist|build|export|web|html|out|public)[\\/]/

export class PlayService {
  public constructor(private readonly files: FileSystemRepository, private readonly connection: ConnectionService) {}

  public plan(project: Project, targets: readonly string[]): PlayPlan {
    const binding: WebBindingDescription | null = project.platform?.defaultBinding() ?? null
    const payloadKind: string = binding?.payload ?? HTML
    const candidates: readonly string[] = payloadKind === HTML ? HTML_TARGETS : ['build']
    return { binding, payloadKind, target: candidates.find((name: string) => targets.includes(name)) ?? null }
  }

  public async findPayload(project: Project, kind: string): Promise<string | null> {
    return kind === HTML ? this.findHtml(project) : this.findBuild(project, kind)
  }

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

  public playUrl(name: string, version: string): string | null {
    return this.connection.hasHost() ? this.connection.build().playUrl(name, version) : null
  }

  public async hostPage(url: string): Promise<string> {
    return this.connection.build().page(url)
  }

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
