import type { GameAnswers } from '../model/game-answers.model'
import { Makefile } from '../model/makefile.model'
import { msg, type Message } from '../model/message.model'
import { FilePath } from '../model/path.model'
import type { Platform } from '../model/platform.model'
import { NAME_PLACEHOLDER, ProjectPlan, type PlannedFile, type TemplateManifest } from '../model/project-plan.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { TemplateRepository, TemplateTree } from '../repository/template.repository'

export interface ScaffoldInput {
  readonly folder: string
  readonly platform: Platform
  readonly answers: GameAnswers
  readonly host: string
  readonly withDemo: boolean
  readonly overwrite: boolean
  readonly report: (message: Message) => void
}

export interface WriteResult {
  readonly written: string[]
  readonly skipped: string[]
}

interface Sources {
  readonly template: TemplateTree | null
  readonly demo: TemplateTree | null
}

const MANIFEST = 'warp-template.json'
const FIRST_BRANCH = 'master'

export class ScaffoldService {
  public constructor(
    private readonly templates: TemplateRepository,
    private readonly files: FileSystemRepository,
    private readonly sourceControl: SourceControlFactory
  ) {}

  public async exists(folder: string): Promise<boolean> {
    return this.files.exists(folder)
  }

  public async author(): Promise<string> {
    return this.sourceControl.userName()
  }

  public async createGame(input: ScaffoldInput): Promise<WriteResult> {
    const written: WriteResult = await this.write(input)
    input.report(msg('Making it a git repository…'))
    const git: SourceControl = this.sourceControl.at(input.folder)
    await git.init(FIRST_BRANCH)
    await git.addAll()
    await git.commit(`Start ${input.answers.title}`).catch(() => undefined)
    return written
  }

  public async write(input: ScaffoldInput): Promise<WriteResult> {
    const sources: Sources = await this.open(input)
    try {
      const plan: PlannedFile[] = await this.plan(input, sources)
      input.report(msg('Writing the project…'))
      return await this.writeAll(input, sources, plan)
    } finally {
      await sources.template?.dispose()
      await sources.demo?.dispose()
    }
  }

  private async open(input: ScaffoldInput): Promise<Sources> {
    const { platform } = input
    const templateUrl: string | null = platform.templateUrl
    if (templateUrl) input.report(msg('Fetching the project template…'))
    const template: TemplateTree | null = templateUrl ? await this.templates.download(templateUrl, platform.toolingRef) : null
    const demoUrl: string | null = input.withDemo ? platform.demoUrl : null
    if (demoUrl) input.report(msg('Fetching the demo…'))
    try {
      return { template, demo: demoUrl ? await this.templates.download(demoUrl, platform.toolingRef) : null }
    } catch (error: unknown) {
      await template?.dispose()
      throw error
    }
  }

  private async plan(input: ScaffoldInput, sources: Sources): Promise<PlannedFile[]> {
    const templateFiles: readonly string[] = sources.template?.files ?? []
    const manifest: TemplateManifest | null = sources.template && templateFiles.includes(MANIFEST)
      ? JSON.parse(new TextDecoder().decode(await sources.template.read(MANIFEST))) as TemplateManifest
      : null
    return new ProjectPlan({
      platform: input.platform, answers: input.answers, templateFiles, manifest,
      demoFiles: sources.demo?.files ?? [], host: input.host
    }).list()
  }

  private async writeAll(input: ScaffoldInput, sources: Sources, plan: readonly PlannedFile[]): Promise<WriteResult> {
    const result: WriteResult = { written: [], skipped: [] }
    for (const file of plan) {
      const target: string = FilePath.join(input.folder, file.target)
      if (!input.overwrite && await this.files.exists(target)) {
        result.skipped.push(file.target)
        continue
      }
      const content: Uint8Array | null = await this.content(input, sources, file)
      if (content === null) continue
      await this.files.writeBytes(target, content)
      result.written.push(file.target)
    }
    return result
  }

  private async content(input: ScaffoldInput, sources: Sources, file: PlannedFile): Promise<Uint8Array | null> {
    const raw: Uint8Array | null = file.content !== null ? new TextEncoder().encode(file.content) : await this.source(sources, file)
    if (raw === null || file.transform === null) return raw
    const text: string = new TextDecoder().decode(raw)
    const named: string = file.transform === 'makefile'
      ? new Makefile(text).withProject(input.answers.name)
      : text.replaceAll(NAME_PLACEHOLDER, input.answers.name)
    return new TextEncoder().encode(named)
  }

  private async source(sources: Sources, file: PlannedFile): Promise<Uint8Array | null> {
    if (!file.source) return null
    const tree: TemplateTree | null = file.source.root === 'template' ? sources.template : sources.demo
    return tree ? tree.read(file.source.path) : null
  }
}
