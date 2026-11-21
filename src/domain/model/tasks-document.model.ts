/**
 * A project's `.vscode/tasks.json`: merging the tasks a template adds into it, comments and formatting kept.
 *
 * @module
 */
import { applyEdits, modify, parse, type Edit, type FormattingOptions, type ParseError } from 'jsonc-parser'
import { DomainError, msg } from './message.model'

/** What {@link TasksDocument.merge} gives back. */
export interface TasksMerge {
  /** The merged document. */
  readonly text: string
  /** The labels of the tasks that were added. */
  readonly added: string[]
}

const FORMATTING: FormattingOptions = { insertSpaces: true, tabSize: 2, eol: '\n' }
const TASKS = 'tasks'

/**
 * A VS Code `tasks.json` (JSON with comments).
 *
 * Merging adds each task of another document whose `label` the document has not got yet, at the end of its
 * `tasks` array; the tasks it has, its comments and its formatting stay as they are.
 */
export class TasksDocument {
  /** Where a project keeps the file, relative to its folder. */
  public static readonly FILE: string = '.vscode/tasks.json'

  /**
   * Takes the document's text.
   *
   * @param text - The text of the file; empty or `null` for a project that has none.
   */
  public constructor(private readonly text: string | null) {}

  /**
   * Lists the labels of the document's tasks.
   *
   * @returns The labels, in order; tasks without a text label are left out.
   * @throws {@link domain/model/message.model!DomainError} When the text is not JSON with comments.
   */
  public labels(): string[] {
    return TasksDocument.tasks(this.text).map((task: unknown) => TasksDocument.label(task)).filter((label: string | null): label is string => label !== null)
  }

  /**
   * Merges the tasks of another document into this one.
   *
   * @param additions - The text of the `tasks.json` whose tasks to add.
   * @returns The merged text and the labels added; when this document is empty, the additions as they are.
   * @throws {@link domain/model/message.model!DomainError} When either text is not JSON with comments.
   */
  public merge(additions: string): TasksMerge {
    const incoming: unknown[] = TasksDocument.tasks(additions)
    if (!this.text?.trim()) return { text: additions, added: incoming.map((task: unknown) => TasksDocument.label(task)).filter((label: string | null): label is string => label !== null) }
    const present: Set<string> = new Set<string>(this.labels())
    let text: string = TasksDocument.withTasksArray(this.text)
    const added: string[] = []
    for (const task of incoming) {
      const label: string | null = TasksDocument.label(task)
      if (label === null || present.has(label)) continue
      text = TasksDocument.apply(text, modify(text, [TASKS, -1], task, { isArrayInsertion: true, formattingOptions: FORMATTING }))
      present.add(label)
      added.push(label)
    }
    return { text, added }
  }

  private static withTasksArray(text: string): string {
    return Array.isArray(TasksDocument.root(text)[TASKS]) ? text : TasksDocument.apply(text, modify(text, [TASKS], [], { formattingOptions: FORMATTING }))
  }

  private static tasks(text: string | null): unknown[] {
    if (!text?.trim()) return []
    const tasks: unknown = TasksDocument.root(text)[TASKS]
    return Array.isArray(tasks) ? tasks : []
  }

  private static root(text: string): Record<string, unknown> {
    const errors: ParseError[] = []
    const value: unknown = parse(text, errors, { allowTrailingComma: true })
    if (errors.length > 0 || typeof value !== 'object' || value === null || Array.isArray(value)) throw new DomainError(msg('{0} is not valid JSON.', TasksDocument.FILE))
    return value as Record<string, unknown>
  }

  private static label(task: unknown): string | null {
    if (typeof task !== 'object' || task === null) return null
    const label: unknown = (task as Record<string, unknown>)['label']
    return typeof label === 'string' ? label : null
  }

  private static apply(text: string, edits: Edit[]): string {
    return applyEdits(text, edits)
  }
}
