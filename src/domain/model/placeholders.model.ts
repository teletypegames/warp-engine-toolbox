import type { GameAnswers } from './game-answers.model'

export type JsonEdits = Readonly<Record<string, unknown>>

const PLACEHOLDER = /\{(name|title|author|description|catalogUrl)\}/g

export class Placeholders {
  private readonly values: Readonly<Record<string, string>>

  public constructor(answers: GameAnswers, host: string) {
    this.values = {
      name: answers.name,
      title: answers.title,
      author: answers.author,
      description: answers.description,
      catalogUrl: host.replace(/\/+$/, '')
    }
  }

  public fill(text: string): string {
    return text.replace(PLACEHOLDER, (_match: string, key: string) => this.values[key] ?? '')
  }

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
