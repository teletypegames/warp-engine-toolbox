/**
 * Recognising WarpEngine projects in the workspace folders.
 *
 * @module
 */
import { LuaHeader } from '../model/lua-header.model'
import { Marker } from '../model/marker.model'
import { Metadata } from '../model/metadata.model'
import type { MetadataFormat } from '../model/platform-description.model'
import type { Platform } from '../model/platform.model'
import { FilePath } from '../model/path.model'
import { MARKER_FILES, Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { ShellRepository, ShellResult } from '../repository/shell.repository'
import type { PlatformService } from './platform.service'

/** A workspace folder to look for a project in. */
export interface ProjectFolder {
  /** The absolute folder path. */
  readonly path: string
  /** The folder's name in the workspace. */
  readonly name: string
}

interface MetadataSource {
  readonly path: string | null
  readonly metadata: Metadata
}

const LUA_CANDIDATES = 20

/** Detects the WarpEngine project of a folder from its marker file, with its platform and metadata, and reads its version. */
export class ProjectService {
  /**
   * Creates the service.
   *
   * @param files - Reads the marker, metadata and version files.
   * @param platforms - Resolves the marker's platform.
   * @param shell - Runs a platform's version command.
   */
  public constructor(
    private readonly files: FileSystemRepository,
    private readonly platforms: PlatformService,
    private readonly shell: ShellRepository
  ) {}

  /**
   * Reads the first marker file of a folder that is a WarpEngine marker and builds the project
   * from it: the platform (when the host knows it), and the metadata from `metadata.json`, the
   * platform's metadata file or the Lua header, as the platform says.
   *
   * @param folder - The folder.
   * @returns The project, or `null` when the folder has no marker.
   */
  public async detect(folder: ProjectFolder): Promise<Project | null> {
    for (const file of MARKER_FILES) {
      const markerPath: string = FilePath.join(folder.path, file)
      const text: string | null = await this.files.readText(markerPath)
      if (text !== null && Marker.isMarker(text)) return this.project(folder, markerPath, Marker.parse(text))
    }
    return null
  }

  /**
   * Reads the current version of a project: from its metadata, or, when the platform keeps it
   * elsewhere, from the platform's version file or by running its version command in the
   * project folder.
   *
   * @param project - The project.
   * @returns The version, or `null` when none can be read.
   */
  public async version(project: Project): Promise<string | null> {
    if (!project.platform?.versionFromCommand) return project.metadata.text('version')
    const versionFile: string | null = project.platform.versionFile
    if (versionFile) return this.fileVersion(FilePath.join(project.folder, versionFile))
    const command: string | null = project.platform.versionCommand
    if (!command) return null
    const result: ShellResult = await this.shell.run(command, project.folder)
    return result.code === 0 && result.stdout.trim() ? result.stdout.trim() : null
  }

  private async fileVersion(path: string): Promise<string | null> {
    const text: string | null = await this.files.readText(path)
    if (text === null) return null
    const version: unknown = Metadata.parseJson(text)?.['version']
    return typeof version === 'string' && version.trim() ? version.trim() : null
  }

  private async project(folder: ProjectFolder, markerPath: string, marker: Marker): Promise<Project> {
    const platform: Platform | null = await this.platforms.find(marker.platform ?? '').catch(() => null)
    const format: MetadataFormat = platform?.metadataFormat ?? 'json'
    const source: MetadataSource = await this.metadata(folder.path, platform, format)
    return new Project({
      folder: folder.path, folderName: folder.name, markerPath, marker, platform,
      metadataPath: source.path, metadataFormat: format, metadata: source.metadata
    })
  }

  private async metadata(folder: string, platform: Platform | null, format: MetadataFormat): Promise<MetadataSource> {
    if (format === 'json') return this.jsonMetadata(FilePath.join(folder, platform?.metadataFile ?? 'metadata.json'))
    if (format === 'lua') return this.luaMetadata(folder, platform)
    return { path: null, metadata: Metadata.empty() }
  }

  private async jsonMetadata(path: string): Promise<MetadataSource> {
    const text: string | null = await this.files.readText(path)
    return { path, metadata: text === null ? Metadata.empty() : Metadata.parse(text, 'json') }
  }

  private async luaMetadata(folder: string, platform: Platform | null): Promise<MetadataSource> {
    const file: string | null = LuaHeader.fileFromCommand(platform?.versionCommand ?? null)
    const candidates: string[] = file ? [FilePath.join(folder, file)] : await this.files.find({ folder, include: '*.lua', exclude: null, limit: LUA_CANDIDATES })
    for (const path of candidates) {
      const text: string | null = await this.files.readText(path)
      if (text?.startsWith('--')) return { path, metadata: Metadata.parse(text, 'lua') }
    }
    return { path: candidates[0] ?? null, metadata: Metadata.empty() }
  }
}
