import type { GameAnswers } from './game-answers.model'
import { Metadata } from './metadata.model'
import type { Platform } from './platform.model'

export class ProjectFiles {
  public static metadataJson(answers: GameAnswers, platform: Platform): string {
    const metadata: Record<string, string> = { name: answers.name, title: answers.title, author: answers.author, desc: answers.description }
    if (answers.license) metadata['license'] = answers.license
    if (answers.category) metadata['category'] = answers.category
    if (!platform.versionFromCommand) metadata['version'] = answers.version
    return Metadata.stringify(metadata)
  }

  public static luaHeader(answers: GameAnswers): string {
    return [
      `-- title: ${answers.title}`,
      `-- name: ${answers.name}`,
      `-- author: ${answers.author}`,
      `-- desc: ${answers.description}`,
      `-- license: ${answers.license}`,
      `-- version: ${answers.version}`,
      '-- script: lua',
      ''
    ].join('\n')
  }

  public static readme(answers: GameAnswers, platform: Platform): string {
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

  public static gitignore(): string {
    return 'dist/\nbuild/\n*.zip\n.version\n'
  }

  public static extensions(recommendations: readonly unknown[]): string {
    return `${JSON.stringify({ recommendations }, null, 2)}\n`
  }
}
