/**
 * The files New Game generates for a new project.
 *
 * @module
 */
import type { GameAnswers } from './game-answers.model'
import { Metadata } from './metadata.model'
import type { Platform } from './platform.model'

const MIT_LICENSE: string = [
  'MIT License',
  '',
  'Copyright (c) {year} {holder}',
  '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy',
  'of this software and associated documentation files (the "Software"), to deal',
  'in the Software without restriction, including without limitation the rights',
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
  'copies of the Software, and to permit persons to whom the Software is',
  'furnished to do so, subject to the following conditions:',
  '',
  'The above copyright notice and this permission notice shall be included in all',
  'copies or substantial portions of the Software.',
  '',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
  'SOFTWARE.',
  ''
].join('\n')

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
   * Renders the `LICENSE` file of the chosen licence, for the licences whose text the toolbox
   * has: `MIT`, with the year and the author as the copyright holder.
   * @param answers - The New Game answers: the licence and the author.
   * @param year - The copyright year.
   * @returns The licence text, or `null` for another licence or without an author.
   */
  public static license(answers: GameAnswers, year: number): string | null {
    const holder: string = answers.author.trim()
    if (answers.license !== 'MIT' || !holder) return null
    return MIT_LICENSE.replace('{year}', String(year)).replace('{holder}', holder)
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
