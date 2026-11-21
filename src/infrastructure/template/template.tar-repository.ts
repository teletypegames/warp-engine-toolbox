/**
 * The {@link domain/repository/template.repository!TemplateRepository} port implemented with a downloaded `.tar.gz` archive and `tar`.
 *
 * @module
 */
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TemplateRepository, TemplateTree } from '../../domain/repository/template.repository'
import { ProcessRunner } from '../process/process.runner'
import { Loopback } from '../http/loopback'

const DOWNLOAD_TIMEOUT_MS = 120_000

class ExtractedTree implements TemplateTree {
  public constructor(private readonly work: string, private readonly root: string, public readonly files: readonly string[]) {}

  public async read(path: string): Promise<Uint8Array> {
    return readFile(join(this.root, path))
  }

  public async dispose(): Promise<void> {
    await rm(this.work, { recursive: true, force: true })
  }
}

/**
 * Downloads a template repository's archive from its Git host (`<repository>/archive/<ref>.tar.gz`,
 * the Gitea form) and unpacks it with `tar` into a temporary `warpengine-*` folder.
 */
export class TarTemplateRepository implements TemplateRepository {
  /**
   * Builds the archive URL of a repository at a ref.
   *
   * @param repositoryUrl - The repository URL; a `.git` suffix and trailing slashes are removed.
   * @param ref - The branch or tag.
   * @returns The URL of the `.tar.gz` archive.
   * @example
   * ```ts
   * TarTemplateRepository.archiveUrl('https://git.example.org/org/game.git', 'main')
   * // 'https://git.example.org/org/game/archive/main.tar.gz'
   * ```
   */
  public static archiveUrl(repositoryUrl: string, ref: string): string {
    return `${repositoryUrl.replace(/\.git$/, '').replace(/\/+$/, '')}/archive/${encodeURIComponent(ref)}.tar.gz`
  }

  /**
   * Lists every file below a folder, recursively.
   *
   * @param root - The folder.
   * @returns The paths relative to the folder, with `/` separators, sorted.
   */
  public static async listFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { recursive: true, withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1).split('\\').join('/'))
      .sort()
  }

  /**
   * Downloads the archive (two-minute timeout), unpacks it into a temporary folder, and
   * steps into its single top folder when it has one.
   *
   * @param repositoryUrl - The repository URL, with or without `.git`.
   * @param ref - The branch or tag.
   * @returns The unpacked tree; its `dispose()` deletes the temporary folder.
   * @throws `Error` when the download answers non-2xx or `tar` fails; the temporary folder is deleted then.
   */
  public async download(repositoryUrl: string, ref: string): Promise<TemplateTree> {
    const work: string = await mkdtemp(join(tmpdir(), 'warpengine-'))
    try {
      const root: string = await this.extract(work, await this.fetchArchive(repositoryUrl, ref))
      return new ExtractedTree(work, root, await TarTemplateRepository.listFiles(root))
    } catch (error: unknown) {
      await rm(work, { recursive: true, force: true })
      throw error
    }
  }

  private async fetchArchive(repositoryUrl: string, ref: string): Promise<Buffer> {
    const response: Response = await fetch(Loopback.reach(TarTemplateRepository.archiveUrl(repositoryUrl, ref)), { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!response.ok) throw new Error(`${repositoryUrl} (${ref}): ${String(response.status)} ${response.statusText}`)
    return Buffer.from(await response.arrayBuffer())
  }

  private async extract(work: string, archive: Buffer): Promise<string> {
    const file: string = join(work, 'source.tar.gz')
    const target: string = join(work, 'source')
    await writeFile(file, archive)
    await mkdir(target)
    await ProcessRunner.runOrThrow('tar', ['-xzf', file, '-C', target], work)
    const entries: string[] = await readdir(target)
    return entries.length === 1 && entries[0] ? join(target, entries[0]) : target
  }
}
