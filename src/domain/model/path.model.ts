/**
 * Path helpers for the domain, which may not use `node:path`.
 *
 * @module
 */
/** Path helpers that work on both `/` and `\` separated paths, without `node:path`. */
export class FilePath {
  /**
   * Joins path segments onto a folder with the folder's own separator.
   * @param folder - The base folder; a trailing separator is dropped.
   * @param parts - Segments to append; each may itself contain `/` or `\`, and empty pieces are skipped.
   * @returns The joined path.
   */
  public static join(folder: string, ...parts: string[]): string {
    const separator: string = FilePath.separatorOf(folder)
    const tail: string[] = parts.flatMap((part: string) => part.split(/[\\/]+/)).filter(Boolean)
    return [folder.replace(/[\\/]+$/, ''), ...tail].join(separator)
  }

  /**
   * Returns the last segment of a path.
   * @param path - A file or folder path.
   * @returns The file or folder name.
   */
  public static basename(path: string): string {
    return path.split(/[\\/]/).pop() ?? path
  }

  /**
   * Returns the folder that contains a path.
   * @param path - A file or folder path.
   * @returns The path without its last segment; the root itself for a top-level entry, and `''` when there is no separator.
   */
  public static dirname(path: string): string {
    const index: number = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return index <= 0 ? path.slice(0, index + 1) : path.slice(0, index)
  }

  /**
   * Returns a path relative to a folder, with `/` separators.
   * @param folder - The base folder.
   * @param path - A path inside that folder.
   * @returns The relative path, or `path` unchanged when it does not start with `folder`.
   */
  public static relative(folder: string, path: string): string {
    const base: string = folder.replace(/[\\/]+$/, '')
    return path.startsWith(base) ? path.slice(base.length).replace(/^[\\/]+/, '').split('\\').join('/') : path
  }

  private static separatorOf(folder: string): string {
    return folder.includes('\\') && !folder.includes('/') ? '\\' : '/'
  }
}
