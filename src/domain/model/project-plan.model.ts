/**
 * The plan of the files New Game writes, from the template, the demo and the generated files.
 *
 * @module
 */
import type { GameAnswers } from './game-answers.model'
import { Marker } from './marker.model'
import type { JsonEdits } from './placeholders.model'
import type { Platform } from './platform.model'
import { ProjectFiles } from './project-files.model'
import { TasksDocument } from './tasks-document.model'

/** Which downloaded archive a planned file is copied from. */
export type PlanRoot = 'template' | 'demo'

/** One file New Game will write into the new project. */
export interface PlannedFile {
  /** The file's path in the new project. */
  readonly target: string
  /** Where the file is copied from, or `null` when {@link PlannedFile.content} holds it. */
  readonly source: {
    /** The archive the file is copied from. */
    readonly root: PlanRoot
    /** The file's path in the archive. */
    readonly path: string
  } | null
  /** The generated content, or `null` when the file is copied. */
  readonly content: string | null
  /** How the copied text is changed: the project name set in a `Makefile`, placeholders filled, JSON edits applied, its tasks merged into the target (`tasks`), or none. */
  readonly transform: 'makefile' | 'fill' | 'json' | 'tasks' | null
  /** The JSON edits to apply when the transform is `json`. */
  readonly edits?: JsonEdits
}

/** The `devcontainer` part of a template manifest: the dev container a project gets. */
export interface DevContainerManifest {
  /** Source path mapped to target path, such as `example-devcontainer.json` to `.devcontainer/devcontainer.json`. */
  readonly files?: Readonly<Record<string, string>>
  /** Files whose placeholders are filled (`{builderImage}` among them). */
  readonly fill?: readonly string[]
  /** A `tasks.json` whose tasks are merged into the project's `.vscode/tasks.json`. */
  readonly tasks?: string
}

/** The `warp-template.json` of a template or demo repository: how its files become a project. */
export interface TemplateManifest {
  /** Source path mapped to target path; when present, only these template files are copied. */
  readonly files?: Readonly<Record<string, string>>
  /** Files whose placeholders are filled. */
  readonly fill?: readonly string[]
  /** JSON edits to apply, keyed by file. */
  readonly json?: Readonly<Record<string, JsonEdits>>
  /** Demo files that are copied although they would be skipped by default. */
  readonly keep?: readonly string[]
  /** Template files left out when the project starts from the demo. */
  readonly templateOnly?: readonly string[]
  /** The dev container the project gets; a toolbox that does not know the key ignores it. */
  readonly devcontainer?: DevContainerManifest
}

/** What a {@link ProjectPlan} is made from. */
export interface PlanInput {
  /** The new game's platform. */
  readonly platform: Platform
  /** The New Game answers. */
  readonly answers: GameAnswers
  /** The files of the template archive. */
  readonly templateFiles: readonly string[]
  /** The template's manifest, if it has one. */
  readonly manifest: TemplateManifest | null
  /** The files of the demo archive; empty when starting from the template only. */
  readonly demoFiles: readonly string[]
  /** The demo's manifest, if it has one. */
  readonly demoManifest?: TemplateManifest | null
  /** The WarpEngine host the game will publish to. */
  readonly host: string
  /** `devcontainer` plans the dev container files only (Add Dev Container); absent plans the whole project. */
  readonly only?: 'devcontainer'
}

const DEMO_SKIPPED: readonly RegExp[] = [
  /^\.git\//, /^\.woodpecker\.ya?ml$/, /^\.woodpecker\//, /^\.gitlab-ci\.yml$/, /^metadata\.json$/, /^README(\.md)?$/i, /^LICEN[CS]E/i
]
const GENERATED_EXAMPLES: ReadonlySet<string> = new Set(['woodpecker.yaml', 'gitlab-ci.yml', 'metadata.json'])
const EXAMPLE_TARGETS: Readonly<Record<string, string>> = { 'makefile.make': 'Makefile', 'tasks.json': '.vscode/tasks.json', 'launch.json': '.vscode/launch.json' }
const EXAMPLE_PREFIX = 'example-'
/** The placeholder in a template target path that becomes the game's name. */
export const NAME_PLACEHOLDER = '{name}'
/** The manifest file name in a template or demo repository. */
export const TEMPLATE_MANIFEST = 'warp-template.json'

/**
 * The list of files New Game writes: template files, demo files, then the generated ones (CI marker, metadata, README, `.gitignore`, extension recommendations).
 *
 * A later file with the same target replaces an earlier one.
 */
export class ProjectPlan {
  private readonly files: Map<string, PlannedFile> = new Map<string, PlannedFile>()
  private readonly tasks: PlannedFile[] = []

  /**
   * Plans the files at once from the input: the template, its dev container, the demo and the generated files, or only the dev container.
   * @param input - The platform, answers, archive listings and manifests.
   */
  public constructor(private readonly input: PlanInput) {
    if (input.only !== 'devcontainer') this.addTemplate()
    this.addDevContainer()
    if (input.only === 'devcontainer') return
    this.addDemo()
    this.addGenerated()
  }

  /**
   * Maps a template's top-level `example-*` file to the file it becomes, when the template has no manifest.
   * @param file - A path in the template.
   * @returns The target path (`example-makefile.make` becomes `Makefile`, `example-tasks.json` becomes `.vscode/tasks.json`), or `null` for files that are not examples or that New Game generates itself.
   */
  public static exampleTarget(file: string): string | null {
    if (file.includes('/') || !file.startsWith(EXAMPLE_PREFIX)) return null
    const rest: string = file.slice(EXAMPLE_PREFIX.length)
    if (GENERATED_EXAMPLES.has(rest)) return null
    return EXAMPLE_TARGETS[rest] ?? rest
  }

  /**
   * Lists the planned files.
   * @returns The files sorted by target path.
   */
  public list(): PlannedFile[] {
    return [...this.files.values()].sort((a: PlannedFile, b: PlannedFile) => a.target.localeCompare(b.target))
  }

  /**
   * Lists the task files to merge into the project's `tasks.json` once the files are written.
   * @returns The merges; their transform is `tasks`.
   */
  public merges(): PlannedFile[] {
    return [...this.tasks]
  }

  private addDevContainer(): void {
    const manifest: DevContainerManifest | undefined = this.input.manifest?.devcontainer
    if (!manifest) return
    const fill: ReadonlySet<string> = new Set<string>(manifest.fill ?? [])
    for (const [from, to] of Object.entries(manifest.files ?? {})) {
      const target: string = to.replaceAll(NAME_PLACEHOLDER, this.input.answers.name)
      this.files.set(target, { target, source: { root: 'template', path: from }, content: null, transform: fill.has(from) ? 'fill' : null })
    }
    if (manifest.tasks) this.tasks.push({ target: TasksDocument.FILE, source: { root: 'template', path: manifest.tasks }, content: null, transform: 'tasks' })
  }

  private addTemplate(): void {
    const manifest: Readonly<Record<string, string>> | undefined = this.input.manifest?.files
    const pairs: [string, string | null][] = manifest
      ? Object.entries(manifest)
      : this.input.templateFiles.map((file: string) => [file, ProjectPlan.exampleTarget(file)])
    const rules: ManifestRules = new ManifestRules(this.input.manifest)
    const withDemo: boolean = this.input.demoFiles.length > 0
    for (const [from, to] of pairs) {
      if (to && !(withDemo && rules.isTemplateOnly(from))) this.copy('template', from, to.replaceAll(NAME_PLACEHOLDER, this.input.answers.name), rules)
    }
  }

  private addDemo(): void {
    const rules: ManifestRules = new ManifestRules(this.input.demoManifest ?? null)
    for (const file of this.input.demoFiles) {
      if (rules.takesDemoFile(file)) this.copy('demo', file, file, rules)
    }
  }

  private addGenerated(): void {
    const { platform, answers } = this.input
    this.write(platform.markerFile, Marker.render(platform.name, null, this.previewUrl()))
    this.addMetadata()
    this.write('README.md', ProjectFiles.readme(answers, platform))
    if (!this.files.has('.gitignore')) this.write('.gitignore', ProjectFiles.gitignore())
    if (platform.recommendedExtensions.length > 0) this.write('.vscode/extensions.json', ProjectFiles.extensions(platform.recommendedExtensions))
  }

  private addMetadata(): void {
    const { platform, answers } = this.input
    const luaFile: string | null = platform.luaFile
    if (platform.metadataFormat === 'json') this.write(platform.metadataFile, ProjectFiles.metadataJson(answers, platform))
    else if (platform.metadataFormat === 'lua' && luaFile && !this.files.has(luaFile)) this.write(luaFile, ProjectFiles.luaHeader(answers))
  }

  private previewUrl(): string {
    return `${this.input.host.replace(/\/$/, '')}/build/config?platform=${this.input.platform.name}`
  }

  private copy(root: PlanRoot, path: string, target: string, rules: ManifestRules): void {
    const edits: JsonEdits | undefined = rules.edits(path)
    const transform: PlannedFile['transform'] = edits ? 'json' : target === 'Makefile' ? 'makefile' : rules.fills(path) ? 'fill' : null
    this.files.set(target, { target, source: { root, path }, content: null, transform, ...(edits ? { edits } : {}) })
  }

  private write(target: string, content: string): void {
    this.files.set(target, { target, source: null, content, transform: null })
  }
}

class ManifestRules {
  private readonly keep: ReadonlySet<string>
  private readonly fill: ReadonlySet<string>
  private readonly json: Readonly<Record<string, JsonEdits>>
  private readonly templateOnly: ReadonlySet<string>

  public constructor(manifest: TemplateManifest | null) {
    const rules: TemplateManifest = manifest ?? {}
    this.templateOnly = new Set(rules.templateOnly ?? [])
    this.keep = new Set(rules.keep ?? [])
    this.fill = new Set(rules.fill ?? [])
    this.json = rules.json ?? {}
  }

  public takesDemoFile(file: string): boolean {
    if (file === TEMPLATE_MANIFEST) return false
    return this.keep.has(file) || !DEMO_SKIPPED.some((pattern: RegExp) => pattern.test(file))
  }

  public isTemplateOnly(path: string): boolean {
    return this.templateOnly.has(path)
  }

  public fills(path: string): boolean {
    return this.fill.has(path)
  }

  public edits(path: string): JsonEdits | undefined {
    return this.json[path]
  }
}
