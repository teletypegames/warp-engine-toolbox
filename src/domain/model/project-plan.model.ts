import type { GameAnswers } from './game-answers.model'
import { Marker } from './marker.model'
import type { JsonEdits } from './placeholders.model'
import type { Platform } from './platform.model'
import { ProjectFiles } from './project-files.model'

export type PlanRoot = 'template' | 'demo'

export interface PlannedFile {
  readonly target: string
  readonly source: { readonly root: PlanRoot; readonly path: string } | null
  readonly content: string | null
  readonly transform: 'makefile' | 'fill' | 'json' | null
  readonly edits?: JsonEdits
}

export interface TemplateManifest {
  readonly files?: Readonly<Record<string, string>>
  readonly fill?: readonly string[]
  readonly json?: Readonly<Record<string, JsonEdits>>
  readonly keep?: readonly string[]
  readonly templateOnly?: readonly string[]
}

export interface PlanInput {
  readonly platform: Platform
  readonly answers: GameAnswers
  readonly templateFiles: readonly string[]
  readonly manifest: TemplateManifest | null
  readonly demoFiles: readonly string[]
  readonly demoManifest?: TemplateManifest | null
  readonly host: string
}

const DEMO_SKIPPED: readonly RegExp[] = [
  /^\.git\//, /^\.woodpecker\.ya?ml$/, /^\.woodpecker\//, /^\.gitlab-ci\.yml$/, /^metadata\.json$/, /^README(\.md)?$/i, /^LICEN[CS]E/i
]
const GENERATED_EXAMPLES: ReadonlySet<string> = new Set(['woodpecker.yaml', 'gitlab-ci.yml', 'metadata.json'])
const EXAMPLE_TARGETS: Readonly<Record<string, string>> = { 'makefile.make': 'Makefile', 'tasks.json': '.vscode/tasks.json', 'launch.json': '.vscode/launch.json' }
const EXAMPLE_PREFIX = 'example-'
export const NAME_PLACEHOLDER = '{name}'
export const TEMPLATE_MANIFEST = 'warp-template.json'

export class ProjectPlan {
  private readonly files: Map<string, PlannedFile> = new Map<string, PlannedFile>()

  public constructor(private readonly input: PlanInput) {
    this.addTemplate()
    this.addDemo()
    this.addGenerated()
  }

  public static exampleTarget(file: string): string | null {
    if (file.includes('/') || !file.startsWith(EXAMPLE_PREFIX)) return null
    const rest: string = file.slice(EXAMPLE_PREFIX.length)
    if (GENERATED_EXAMPLES.has(rest)) return null
    return EXAMPLE_TARGETS[rest] ?? rest
  }

  public list(): PlannedFile[] {
    return [...this.files.values()].sort((a: PlannedFile, b: PlannedFile) => a.target.localeCompare(b.target))
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
