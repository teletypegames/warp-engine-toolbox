/**
 * Port to the files of the workspace.
 *
 * @module
 */
/** A glob search below one folder for {@link FileSystemRepository.find}. */
export interface FileQuery {
  /** The absolute folder the patterns are relative to. */
  readonly folder: string
  /** The glob of the files to find. */
  readonly include: string
  /** The glob of the files to leave out, or `null` for the workspace default excludes. */
  readonly exclude: string | null
  /** The most files to return. */
  readonly limit: number
}

/** Port to the file system of the workspace, by absolute path. */
export interface FileSystemRepository {
  /**
   * Reads a file as UTF-8 text.
   *
   * @param path - The absolute path.
   * @returns The text, or `null` when the file cannot be read (missing or unreadable).
   */
  readText(path: string): Promise<string | null>
  /**
   * Writes UTF-8 text to a file, replacing it.
   *
   * @param path - The absolute path.
   * @param text - The new content.
   */
  writeText(path: string, text: string): Promise<void>
  /**
   * Reads a file as bytes.
   *
   * @param path - The absolute path.
   * @returns The content.
   * @throws When the file cannot be read.
   */
  readBytes(path: string): Promise<Uint8Array>
  /**
   * Writes bytes to a file, replacing it.
   *
   * @param path - The absolute path.
   * @param bytes - The new content.
   */
  writeBytes(path: string, bytes: Uint8Array): Promise<void>
  /**
   * Tells whether a file or folder exists.
   *
   * @param path - The absolute path.
   * @returns `true` when it exists.
   */
  exists(path: string): Promise<boolean>
  /**
   * Finds files by glob.
   *
   * @param query - The folder, patterns and limit.
   * @returns The absolute paths of the matches.
   */
  find(query: FileQuery): Promise<string[]>
  /**
   * Reads when a file last changed.
   *
   * @param path - The absolute path.
   * @returns The modification time in milliseconds since the epoch.
   * @throws When the file does not exist.
   */
  modifiedAt(path: string): Promise<number>
}
