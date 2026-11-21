/**
 * Placeholder filling and JSON edits for the files New Game copies from a template.
 *
 * @module
 */
import type { GameAnswers } from './game-answers.model'

/** JSON edits a template manifest asks for: a dotted key path mapped to the value to set there, its strings filled with placeholders. */
export type JsonEdits = Readonly<Record<string, unknown>>

const PLACEHOLDER = /\{(name|title|author|description|catalogUrl|builderImage)\}/g

/**
 * Fills the New Game answers into template files.
 *
 * Recognised placeholders: `{name}`, `{title}`, `{author}`, `{description}`, `{catalogUrl}` (the host without a trailing slash)
 * and `{builderImage}` (the CI builder image of the platform, which a dev container builds on).
 */
export class Placeholders {
  private readonly values: Readonly<Record<string, string>>

  /**
   * Collects the placeholder values.
   * @param answers - The answers of the New Game questions.
   * @param host - The WarpEngine host the game will publish to.
   * @param builderImage - The platform's CI builder image; `null` (no builder) fills an empty text.
   */
  public constructor(answers: GameAnswers, host: string, builderImage: string | null = null) {
    this.values = {
      name: answers.name,
      title: answers.title,
      author: answers.author,
      description: answers.description,
      catalogUrl: host.replace(/\/+$/, ''),
      builderImage: builderImage ?? ''
    }
  }

  /**
   * Replaces every known placeholder in a text.
   * @param text - The template text.
   * @returns The text with the placeholders replaced.
   */
  public fill(text: string): string {
    return text.replace(PLACEHOLDER, (_match: string, key: string) => this.values[key] ?? '')
  }

  /**
   * Applies JSON edits to a JSON document, filling placeholders in the new values.
   *
   * Missing objects on a key path are created.
   * @param json - The JSON text; its root must be an object.
   * @param edits - The values to set, keyed by dotted path.
   * @returns The edited JSON with two-space indentation and a trailing newline.
   * @throws Error when the root of the document is not an object, and SyntaxError when the text is not JSON.
   */
  public edit(json: string, edits: JsonEdits): string {
    const document: unknown = JSON.parse(json)
    if (!Placeholders.isObject(document)) throw new Error('a JSON edit needs an object document')
    for (const [path, value] of Object.entries(edits)) this.set(document, path.split('.'), this.filled(value))
    return `${JSON.stringify(document, null, 2)}\n`
  }

  private filled(value: unknown): unknown {
    if (typeof value === 'string') return this.fill(value)
    if (Array.isArray(value)) return value.map((item: unknown) => this.filled(item))
    if (Placeholders.isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]: [string, unknown]) => [key, this.filled(item)]))
    return value
  }

  private set(document: Record<string, unknown>, path: readonly string[], value: unknown): void {
    const [head, ...rest] = path
    if (head === undefined || head.length === 0) return
    if (rest.length === 0) {
      document[head] = value
      return
    }
    const child: unknown = document[head]
    const next: Record<string, unknown> = Placeholders.isObject(child) ? child : {}
    document[head] = next
    this.set(next, rest, value)
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
