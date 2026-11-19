/**
 * Translation of the runtime texts with the `l10n` bundles.
 *
 * @module
 */
import * as vscode from 'vscode'
import { DomainError, type Message, type MessageArgument } from '../../domain/model/message.model'

/**
 * Translates an English text with `vscode.l10n.t`.
 *
 * @param text - The English text, the bundle key, with `{0}` placeholders.
 * @param args - The values of the placeholders.
 * @returns The text in the editor's language, English when there is no translation.
 */
export function t(text: string, ...args: MessageArgument[]): string {
  return vscode.l10n.t(text, ...args)
}

/**
 * Translates a domain {@link domain/model/message.model!Message}.
 *
 * @param message - The English text and its arguments.
 * @returns The text in the editor's language.
 */
export function translate(message: Message): string {
  return vscode.l10n.t(message.text, ...message.args)
}

/**
 * Turns anything thrown into a text to show: a {@link domain/model/message.model!DomainError} translated, an `Error` its message, anything else as a string.
 *
 * @param error - What was thrown.
 * @returns The text.
 */
export function errorText(error: unknown): string {
  if (error instanceof DomainError) return translate(error.detail)
  return error instanceof Error ? error.message : String(error)
}
