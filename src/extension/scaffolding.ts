import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { luaFileFromCommand } from '../domain/luaHeader'
import { applyMakefile, planProject, type GameAnswers, type PlannedFile, type TemplateManifest } from '../domain/template'
import type { PlatformDescription } from '../domain/types'
import { downloadRepository, listFiles, type Extracted } from '../infrastructure/archive'

export interface WriteResult {
  readonly written: string[]
  readonly skipped: string[]
}

export async function writeProject(input: {
  readonly folder: string
  readonly platform: PlatformDescription
  readonly answers: GameAnswers
  readonly host: string
  readonly withDemo: boolean
  readonly overwrite: boolean
  readonly report: (message: string) => void
}): Promise<WriteResult> {
  const tooling: Readonly<Record<string, unknown>> = input.platform.tooling
  const ref: string = typeof tooling['ref'] === 'string' ? tooling['ref'] : 'master'
  const opened: Extracted[] = []
  try {
    let template: Extracted | null = null
    if (typeof tooling['template'] === 'string') {
      input.report('Fetching the project template…')
      template = await downloadRepository(tooling['template'], ref)
      opened.push(template)
    }
    let demo: Extracted | null = null
    if (input.withDemo && typeof tooling['demo'] === 'string') {
      input.report('Fetching the demo…')
      demo = await downloadRepository(tooling['demo'], ref)
      opened.push(demo)
    }
    const templateFiles: string[] = template ? await listFiles(template.root) : []
    const manifest: TemplateManifest | null = template && templateFiles.includes('warp-template.json')
      ? JSON.parse(await readFile(join(template.root, 'warp-template.json'), 'utf8')) as TemplateManifest
      : null
    const plan: PlannedFile[] = planProject({
      platform: input.platform,
      answers: input.answers,
      templateFiles,
      manifest,
      demoFiles: demo ? await listFiles(demo.root) : [],
      host: input.host,
      luaFile: luaFileFromCommand(input.platform.version.command)
    })

    input.report('Writing the project…')
    const result: WriteResult = { written: [], skipped: [] }
    for (const file of plan) {
      const target: string = join(input.folder, file.target)
      if (!input.overwrite && await exists(target)) {
        result.skipped.push(file.target)
        continue
      }
      let content: Buffer
      if (file.content !== null) content = Buffer.from(file.content)
      else if (file.source) content = await readFile(join(file.source.root === 'template' ? template?.root ?? '' : demo?.root ?? '', file.source.path))
      else continue
      if (file.transform === 'makefile') content = Buffer.from(applyMakefile(content.toString('utf8'), input.answers.name))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, content)
      result.written.push(file.target)
    }
    return result
  } finally {
    for (const extracted of opened) await extracted.dispose()
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
