/**
 * The domain's user-facing messages, the error that carries one and the remedies the user can be offered.
 *
 * @module
 */
/** A value substituted into a {@link Message} placeholder. */
export type MessageArgument = string | number

/**
 * A user-facing text from the domain: English with `{0}`, `{1}`, … placeholders
 * and the arguments for them; the extension translates it before showing it.
 */
export interface Message {
  /** The English text with its placeholders; also the translation key. */
  readonly text: string
  /** The values of the placeholders, by index. */
  readonly args: readonly MessageArgument[]
}

/**
 * Creates a {@link Message}.
 *
 * @param text - The English text with `{0}`-style placeholders.
 * @param args - The placeholder values, in order.
 * @returns The message.
 *
 * @example
 * ```ts
 * throw new DomainError(msg('{0} is not an image the catalog takes ({1}).', name, ImageTypes.extensions().join(', ')))
 * ```
 */
export function msg(text: string, ...args: MessageArgument[]): Message {
  return { text, args }
}

/**
 * The step that puts a failure or a missing setup right; the extension turns it into a button that runs the command
 * doing it.
 */
export type Remedy =
  | 'selectHost' | 'signIn' | 'reauthorize' | 'installLocalEngine' | 'connect' | 'setupLocalCi' | 'editMetadata' | 'addToProject' | 'newGame'
  | 'repairHost' | 'startDocker' | 'startLocalEngine'

/** A domain failure carrying a {@link Message}; its `message` is the English text with the arguments filled in. */
export class DomainError extends Error {
  /** The message, for the extension to translate. */
  public readonly detail: Message
  /** The step that fixes it, or `null` when there is none to offer. */
  public readonly remedy: Remedy | null

  /**
   * Creates the error.
   *
   * @param detail - What went wrong.
   * @param remedy - The step that fixes it, offered to the user as a button.
   */
  public constructor(detail: Message, remedy: Remedy | null = null) {
    super(DomainError.format(detail))
    this.name = 'DomainError'
    this.detail = detail
    this.remedy = remedy
  }

  private static format(message: Message): string {
    return message.text.replace(/\{(\d+)\}/g, (whole: string, index: string) => {
      const value: MessageArgument | undefined = message.args[Number(index)]
      return value === undefined ? whole : String(value)
    })
  }
}
