/**
 * The domain's user-facing messages and the error that carries one.
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

/** A domain failure carrying a {@link Message}; its `message` is the English text with the arguments filled in. */
export class DomainError extends Error {
  /** The message, for the extension to translate. */
  public readonly detail: Message

  /**
   * Creates the error.
   *
   * @param detail - What went wrong.
   */
  public constructor(detail: Message) {
    super(DomainError.format(detail))
    this.name = 'DomainError'
    this.detail = detail
  }

  private static format(message: Message): string {
    return message.text.replace(/\{(\d+)\}/g, (whole: string, index: string) => {
      const value: MessageArgument | undefined = message.args[Number(index)]
      return value === undefined ? whole : String(value)
    })
  }
}
