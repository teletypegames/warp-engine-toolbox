/**
 * Port to the template repositories New Game scaffolds from.
 *
 * @module
 */
/** The unpacked files of a downloaded template, held in a temporary folder until disposed. */
export interface TemplateTree {
  /** The paths of every file, relative to the template root, with `/` separators, sorted. */
  readonly files: readonly string[]
  /**
   * Reads one file of the template.
   *
   * @param path - A path from {@link TemplateTree.files}.
   * @returns The content.
   */
  read(path: string): Promise<Uint8Array>
  /** Deletes the temporary folder; the tree cannot be read afterwards. */
  dispose(): Promise<void>
}

/** Port that downloads a template repository as an archive and unpacks it. */
export interface TemplateRepository {
  /**
   * Downloads and unpacks the archive of a repository at a ref.
   *
   * @param repositoryUrl - The repository URL, with or without `.git`.
   * @param ref - The branch or tag.
   * @returns The unpacked tree; call {@link TemplateTree.dispose} when done.
   * @throws When the download or the unpacking fails; nothing is left behind then.
   */
  download(repositoryUrl: string, ref: string): Promise<TemplateTree>
}
