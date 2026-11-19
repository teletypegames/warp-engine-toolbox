/**
 * A WarpEngine project in the workspace.
 *
 * @module
 */
import type { Marker } from './marker.model'
import type { Metadata } from './metadata.model'
import type { MetadataFormat } from './platform-description.model'
import type { Platform } from './platform.model'

/** The CI files that mark a folder as a WarpEngine project, in the order they are looked for. */
export const MARKER_FILES: readonly string[] = ['.woodpecker.yaml', '.woodpecker.yml', '.gitlab-ci.yml']

/** What a {@link Project} is built from, as the project service reads it from a folder. */
export interface ProjectInit {
  /** The project's root folder. */
  readonly folder: string
  /** The root folder's name, the last fallback for the project name. */
  readonly folderName: string
  /** The CI marker file's path. */
  readonly markerPath: string
  /** The parsed CI marker. */
  readonly marker: Marker
  /** The project's platform, or `null` when the host does not know it. */
  readonly platform: Platform | null
  /** The metadata file's path, or `null` when the project has none. */
  readonly metadataPath: string | null
  /** How the metadata file is written. */
  readonly metadataFormat: MetadataFormat
  /** The parsed metadata values. */
  readonly metadata: Metadata
}

/** A WarpEngine project in the workspace: a folder with a CI marker, its platform and its metadata. */
export class Project {
  /** The project's root folder. */
  public readonly folder: string
  /** The CI marker file's path. */
  public readonly markerPath: string
  /** The parsed CI marker. */
  public readonly marker: Marker
  /** The project's platform, or `null` when the host does not know it. */
  public readonly platform: Platform | null
  /** The metadata file's path, or `null` when the project has none. */
  public readonly metadataPath: string | null
  /** How the metadata file is written. */
  public readonly metadataFormat: MetadataFormat
  /** The parsed metadata values. */
  public readonly metadata: Metadata
  /** The software name: from the marker, else the metadata's `name`, else the folder name. */
  public readonly name: string

  /**
   * Builds the project and resolves its name.
   * @param init - The parts read from the project folder.
   */
  public constructor(init: ProjectInit) {
    this.folder = init.folder
    this.markerPath = init.markerPath
    this.marker = init.marker
    this.platform = init.platform
    this.metadataPath = init.metadataPath
    this.metadataFormat = init.metadataFormat
    this.metadata = init.metadata
    this.name = init.marker.name ?? init.metadata.text('name') ?? init.folderName
  }

  /** The platform id written in the marker, or `''` when it names none. */
  public get platformName(): string {
    return this.marker.platform ?? ''
  }

  /** The platform's human-readable name, falling back to {@link Project.platformName}. */
  public get platformLabel(): string {
    return this.platform?.label ?? this.platformName
  }

  /** The metadata's `title`, falling back to {@link Project.name}. */
  public get title(): string {
    return this.metadata.trimmed('title') ?? this.name
  }

  /** Whether the toolbox can write a new version into the metadata file (it exists and is not a custom format). */
  public get versionWritable(): boolean {
    return this.metadataPath !== null && this.metadataFormat !== 'custom'
  }

  /**
   * Tells whether a file is this project's metadata file.
   * @param path - The file's path.
   * @returns `true` when it is the metadata file.
   */
  public isMetadata(path: string): boolean {
    return this.metadataPath === path
  }
}
