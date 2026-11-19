export type MessageArgument = string | number

export interface Message {
  readonly text: string
  readonly args: readonly MessageArgument[]
}

export function msg(text: string, ...args: MessageArgument[]): Message {
  return { text, args }
}

export class DomainError extends Error {
  public readonly detail: Message

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
