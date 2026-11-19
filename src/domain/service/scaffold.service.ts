/**
 * Creating a new game from its platform's template: New Game.
 *
 * @module
 */
import type { GameAnswers } from '../model/game-answers.model'
import { Makefile } from '../model/makefile.model'
import { msg, type Message } from '../model/message.model'
import { FilePath } from '../model/path.model'
import type { Platform } from '../model/platform.model'
import { Placeholders } from '../model/placeholders.model'
import { ProjectPlan, TEMPLATE_MANIFEST, type PlannedFile, type TemplateManifest } from '../model/project-plan.model'
import type { FileSystemRepository } from '../repository/file-system.repository'
import type { SourceControl, SourceControlFactory } from '../repository/source-control.repository'
import type { TemplateRepository, TemplateTree } from '../repository/template.repository'

/** What {@link ScaffoldService.write} and {@link ScaffoldService.createGame} need. */
export interface ScaffoldInput {
  /** The absolute folder of the new project. */
  readonly folder: string
  /** The platform, which names the template and demo repositories. */
  readonly platform: Platform
  /** The user's answers: name, title, author and the rest. */
  readonly answers: GameAnswers
  /** The host URL written into the project. */
  readonly host: string
  /** Whether to add the platform's demo game. */
  readonly withDemo: boolean
  /** Whether to replace files that exist already; otherwise they are skipped. */
  readonly overwrite: boolean
  /** Called with each step, for the progress notification. */
  readonly report: (message: Message) => void
}

/** Which files a scaffold wrote and which it left alone. */
export interface WriteResult {
  /** The written files, relative to the project folder. */
  readonly written: string[]
  /** The files that existed and were kept, relative to the project folder. */
  readonly skipped: string[]
}

interface Sources {
  readonly template: TemplateTree | null
  readonly demo: TemplateTree | null
}

const FIRST_BRANCH = 'master'

/** Writes a new project from its platform's template and demo repositories, filled with the user's answers. */
export class ScaffoldService {
  /**
   * Creates the service.
   *
   * @param templates - Downloads the template and demo archives.
   * @param files - Writes the project files.
   * @param sourceControl - Makes the folder a git repository and reads the git user name.
   */
  public constructor(
    private readonly templates: TemplateRepository,
    private readonly files: FileSystemRepository,
    private readonly sourceControl: SourceControlFactory
  ) {}

  /**
   * Tells whether a folder exists already.
   *
   * @param folder - The absolute path.
   * @returns `true` when it exists.
   */
  public async exists(folder: string): Promise<boolean> {
    return this.files.exists(folder)
  }

  /**
   * Gives the default author of a new game: the global git `user.name`.
   *
   * @returns The name; empty when none is set.
   */
  public async author(): Promise<string> {
    return this.sourceControl.userName()
  }

  /**
   * Writes the project (see {@link ScaffoldService.write}), then runs `git init`, stages
   * everything and makes the first commit; a failing commit (e.g. no git identity) is ignored.
   *
   * @param input - The folder, platform, answers and options.
   * @returns The written and skipped files.
   * @throws When a download, a file write, `git init` or `git add` fails.
   */
  public async createGame(input: ScaffoldInput): Promise<WriteResult> {
    const written: WriteResult = await this.write(input)
    input.report(msg('Making it a git repository…'))
    const git: SourceControl = this.sourceControl.at(input.folder)
    await git.init(FIRST_BRANCH)
    await git.addAll()
    await git.commit(`Start ${input.answers.title}`).catch(() => undefined)
    return written
  }

  /**
   * Downloads the platform's template (and demo, when asked), plans the files from the
   * template manifests and the answers, and writes them into the folder, filling in the
   * placeholders. The downloads are deleted afterwards.
   *
   * @param input - The folder, platform, answers and options.
   * @returns The written and skipped files.
   * @throws When a download or a file write fails.
   */
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
    const demoFiles: readonly string[] = sources.demo?.files ?? []
    return new ProjectPlan({
      platform: input.platform, answers: input.answers, templateFiles, manifest: await this.manifest(sources.template),
      demoFiles, demoManifest: await this.manifest(sources.demo), host: input.host
    }).list()
  }

  private async manifest(tree: TemplateTree | null): Promise<TemplateManifest | null> {
    if (!tree?.files.includes(TEMPLATE_MANIFEST)) return null
    return JSON.parse(new TextDecoder().decode(await tree.read(TEMPLATE_MANIFEST))) as TemplateManifest
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
    const placeholders: Placeholders = new Placeholders(input.answers, input.host)
    const named: string = file.transform === 'makefile'
      ? new Makefile(text).withProject(input.answers.name)
      : file.transform === 'json' ? placeholders.edit(text, file.edits ?? {}) : placeholders.fill(text)
    return new TextEncoder().encode(named)
  }

  private async source(sources: Sources, file: PlannedFile): Promise<Uint8Array | null> {
    if (!file.source) return null
    const tree: TemplateTree | null = file.source.root === 'template' ? sources.template : sources.demo
    return tree ? tree.read(file.source.path) : null
  }
}
