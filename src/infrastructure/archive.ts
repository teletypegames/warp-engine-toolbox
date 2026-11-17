import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runOrThrow } from './process'

export interface Extracted {
  readonly root: string
  readonly dispose: () => Promise<void>
}

export function archiveUrl(repositoryUrl: string, ref: string): string {
  return `${repositoryUrl.replace(/\.git$/, '').replace(/\/+$/, '')}/archive/${encodeURIComponent(ref)}.tar.gz`
}

export async function downloadRepository(repositoryUrl: string, ref: string): Promise<Extracted> {
  const work: string = await mkdtemp(join(tmpdir(), 'warpengine-'))
  const dispose = async (): Promise<void> => { await rm(work, { recursive: true, force: true }) }
  try {
    const response: Response = await fetch(archiveUrl(repositoryUrl, ref), { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error(`${repositoryUrl} (${ref}): ${String(response.status)} ${response.statusText}`)
    const archive: string = join(work, 'source.tar.gz')
    await writeFile(archive, Buffer.from(await response.arrayBuffer()))
    const target: string = join(work, 'source')
    await mkdir(target)
    await runOrThrow('tar', ['-xzf', archive, '-C', target], work)
    const entries: string[] = await readdir(target)
    const root: string = entries.length === 1 && entries[0] ? join(target, entries[0]) : target
    return { root, dispose }
  } catch (error: unknown) {
    await dispose()
    throw error
  }
}

export async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1).split('\\').join('/'))
    .sort()
}
