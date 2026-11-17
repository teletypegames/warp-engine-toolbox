import type { Marker } from './marker.model'
import type { Metadata } from './metadata.model'
import type { MetadataFormat } from './platform-description.model'
import type { Platform } from './platform.model'

export const MARKER_FILES: readonly string[] = ['.woodpecker.yaml', '.woodpecker.yml', '.gitlab-ci.yml']

export interface ProjectInit {
  readonly folder: string
  readonly folderName: string
  readonly markerPath: string
  readonly marker: Marker
  readonly platform: Platform | null
  readonly metadataPath: string | null
  readonly metadataFormat: MetadataFormat
  readonly metadata: Metadata
}

export class Project {
  public readonly folder: string
  public readonly markerPath: string
  public readonly marker: Marker
  public readonly platform: Platform | null
  public readonly metadataPath: string | null
  public readonly metadataFormat: MetadataFormat
  public readonly metadata: Metadata
  public readonly name: string

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

  public get platformName(): string {
    return this.marker.platform ?? ''
  }

  public get platformLabel(): string {
    return this.platform?.label ?? this.platformName
  }

  public get title(): string {
    return this.metadata.trimmed('title') ?? this.name
  }

  public get versionWritable(): boolean {
    return this.metadataPath !== null && this.metadataFormat !== 'custom'
  }

  public isMetadata(path: string): boolean {
    return this.metadataPath === path
  }
}
