/**
 * The Makefile targets of a project.
 *
 * @module
 */
import { Makefile } from '../model/makefile.model'
import { FilePath } from '../model/path.model'
import type { Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'

/** Reads the targets of a project's Makefile. */
export class MakeService {
  /**
   * Creates the service.
   *
   * @param files - Reads the Makefile.
   */
  public constructor(private readonly files: FileSystemRepository) {}

  /**
   * Lists the targets of the Makefile in the project folder.
   *
   * @param project - The project.
   * @returns The target names; empty when there is no Makefile.
   */
  public async targets(project: Project): Promise<string[]> {
    const text: string | null = await this.files.readText(FilePath.join(project.folder, Makefile.FILE))
    return text === null ? [] : new Makefile(text).targets()
  }
}
