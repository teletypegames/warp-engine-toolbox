/**
 * The files New Game generates for a new project.
 *
 * @module
 */
import type { GameAnswers } from './game-answers.model'
import { Metadata } from './metadata.model'
import type { Platform } from './platform.model'

/** The contents of the files New Game generates rather than copies from the template. */
export class ProjectFiles {
  /**
   * Renders `metadata.json` for a new game.
   * @param answers - The New Game answers.
   * @param platform - The game's platform; the version is left out when the platform reads it from a command.
   * @returns The JSON text.
   */
  public static metadataJson(answers: GameAnswers, platform: Platform): string {
    const metadata: Record<string, string> = { name: answers.name, title: answers.title, author: answers.author, desc: answers.description }
    if (answers.license) metadata['license'] = answers.license
    if (answers.category) metadata['category'] = answers.category
    if (!platform.versionFromCommand) metadata['version'] = answers.version
    return Metadata.stringify(metadata)
  }

  /**
   * Renders the Lua comment header that holds the metadata of a Lua-based game.
   * @param answers - The New Game answers.
   * @returns The header lines, ending with a newline.
   */
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

  /**
   * Renders the new game's `README.md`.
   * @param answers - The New Game answers.
   * @param platform - The game's platform.
   * @returns The Markdown text.
   */
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

  /**
   * Renders the default `.gitignore`, ignoring build output and archives.
   * @returns The file's text.
   */
  public static gitignore(): string {
    return 'dist/\nbuild/\n*.zip\n.version\n'
  }

  /**
   * Renders `.vscode/extensions.json`.
   * @param recommendations - The extension ids to recommend.
   * @returns The JSON text.
   */
  public static extensions(recommendations: readonly unknown[]): string {
    return `${JSON.stringify({ recommendations }, null, 2)}\n`
  }
}
