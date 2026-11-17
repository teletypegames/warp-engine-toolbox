import * as vscode from 'vscode'
import { DomainError, type Message, type MessageArgument } from '../../domain/model/message.model'

export function t(text: string, ...args: MessageArgument[]): string {
  return vscode.l10n.t(text, ...args)
}

export function translate(message: Message): string {
  return vscode.l10n.t(message.text, ...message.args)
}

export function errorText(error: unknown): string {
  if (error instanceof DomainError) return translate(error.detail)
  return error instanceof Error ? error.message : String(error)
}
