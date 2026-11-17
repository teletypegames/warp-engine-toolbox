import { Makefile } from '../model/makefile.model'
import { FilePath } from '../model/path.model'
import type { Project } from '../model/project.model'
import type { FileSystemRepository } from '../repository/file-system.repository'

export class MakeService {
  public constructor(private readonly files: FileSystemRepository) {}

  public async targets(project: Project): Promise<string[]> {
    const text: string | null = await this.files.readText(FilePath.join(project.folder, Makefile.FILE))
    return text === null ? [] : new Makefile(text).targets()
  }
}
