import { renderMarker } from './marker'
import type { PlatformDescription } from './types'

export interface GameAnswers {
  readonly name: string
  readonly title: string
  readonly author: string
  readonly license: string
  readonly category: string | null
  readonly description: string
  readonly version: string
}

export interface PlannedFile {
  readonly target: string
  readonly source: { readonly root: 'template' | 'demo'; readonly path: string } | null
  readonly content: string | null
  readonly transform: 'makefile' | null
}

export interface TemplateManifest {
  readonly files?: Readonly<Record<string, string>>
}

export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/

const DEMO_SKIPPED: readonly RegExp[] = [
  /^\.git\//, /^\.woodpecker\.ya?ml$/, /^\.woodpecker\//, /^\.gitlab-ci\.yml$/, /^metadata\.json$/, /^README(\.md)?$/i, /^LICEN[CS]E/i
]

const GENERATED_EXAMPLES: ReadonlySet<string> = new Set(['woodpecker.yaml', 'gitlab-ci.yml', 'metadata.json'])

export function exampleTarget(file: string): string | null {
  const slash: number = file.lastIndexOf('/')
  const base: string = file.slice(slash + 1)
  if (slash >= 0 || !base.startsWith('example-')) return null
  const rest: string = base.slice('example-'.length)
  if (GENERATED_EXAMPLES.has(rest)) return null
  if (rest === 'makefile.make') return 'Makefile'
  if (rest === 'tasks.json') return '.vscode/tasks.json'
  if (rest === 'launch.json') return '.vscode/launch.json'
  return rest
}

export function planProject(input: {
  readonly platform: PlatformDescription
  readonly answers: GameAnswers
  readonly templateFiles: readonly string[]
  readonly manifest: TemplateManifest | null
  readonly demoFiles: readonly string[]
  readonly host: string
  readonly luaFile: string | null
}): PlannedFile[] {
  const plan = new Map<string, PlannedFile>()
  const add = (file: PlannedFile): void => { plan.set(file.target, file) }

  if (input.manifest?.files) {
    for (const [from, to] of Object.entries(input.manifest.files)) {
      add({ target: to, source: { root: 'template', path: from }, content: null, transform: to === 'Makefile' ? 'makefile' : null })
    }
  } else {
    for (const file of input.templateFiles) {
      const target: string | null = exampleTarget(file)
      if (target) add({ target, source: { root: 'template', path: file }, content: null, transform: target === 'Makefile' ? 'makefile' : null })
    }
  }

  for (const file of input.demoFiles) {
    if (DEMO_SKIPPED.some((pattern: RegExp) => pattern.test(file))) continue
    add({ target: file, source: { root: 'demo', path: file }, content: null, transform: file === 'Makefile' ? 'makefile' : null })
  }

  const marker: string = input.platform.ci.marker?.file ?? '.woodpecker.yaml'
  const preview = `${input.host.replace(/\/$/, '')}/build/config?platform=${input.platform.name}`
  add({ target: marker, source: null, content: renderMarker(input.platform.name, null, preview), transform: null })

  if (input.platform.metadata.format === 'json') {
    add({ target: input.platform.metadata.file ?? 'metadata.json', source: null, content: metadataJson(input.answers, input.platform), transform: null })
  } else if (input.platform.metadata.format === 'lua' && input.luaFile && !plan.has(input.luaFile)) {
    add({ target: input.luaFile, source: null, content: luaHeader(input.answers), transform: null })
  }

  add({ target: 'README.md', source: null, content: readme(input.answers, input.platform), transform: null })
  if (!plan.has('.gitignore')) add({ target: '.gitignore', source: null, content: 'dist/\nbuild/\n*.zip\n.version\n', transform: null })

  const extensions: unknown = input.platform.tooling['extensions']
  if (Array.isArray(extensions) && extensions.length > 0) {
    add({ target: '.vscode/extensions.json', source: null, content: `${JSON.stringify({ recommendations: extensions }, null, 2)}\n`, transform: null })
  }

  return [...plan.values()].sort((a: PlannedFile, b: PlannedFile) => a.target.localeCompare(b.target))
}

export function applyMakefile(text: string, name: string): string {
  return /^PROJECT\s*[:?]?=.*$/m.test(text) ? text.replace(/^PROJECT\s*([:?]?=).*$/m, `PROJECT $1 ${name}`) : text
}

export function metadataJson(answers: GameAnswers, platform: PlatformDescription): string {
  const metadata: Record<string, string> = { name: answers.name, title: answers.title, author: answers.author, desc: answers.description }
  if (answers.license) metadata['license'] = answers.license
  if (answers.category) metadata['category'] = answers.category
  if (platform.version.source === 'metadata') metadata['version'] = answers.version
  return `${JSON.stringify(metadata, null, 2)}\n`
}

export function luaHeader(answers: GameAnswers): string {
  const lines: string[] = [
    `-- title: ${answers.title}`,
    `-- name: ${answers.name}`,
    `-- author: ${answers.author}`,
    `-- desc: ${answers.description}`,
    `-- license: ${answers.license}`,
    `-- version: ${answers.version}`,
    '-- script: lua'
  ]
  return `${lines.join('\n')}\n`
}

function readme(answers: GameAnswers, platform: PlatformDescription): string {
  return [
    `# ${answers.title}`,
    '',
    answers.description,
    '',
    `A ${platform.label} game, built and published by WarpEngine: every push to the default branch builds it,`,
    'a version tag releases it.',
    ''
  ].join('\n')
}
