import * as vscode from 'vscode'
import type { Message } from '../../domain/model/message.model'
import { translate } from './l10n'

export interface PickItem<T> extends vscode.QuickPickItem {
  readonly value: T
}

export type Report = (message: Message) => void

export class Dialogs {
  public static async pick<T>(items: readonly PickItem<T>[], options: vscode.QuickPickOptions): Promise<T | undefined> {
    return (await vscode.window.showQuickPick(items, options))?.value
  }

  public static async input(options: vscode.InputBoxOptions): Promise<string | undefined> {
    return vscode.window.showInputBox(options)
  }

  public static async confirm(message: string, action: string): Promise<boolean> {
    return (await vscode.window.showWarningMessage(message, { modal: true }, action)) === action
  }

  public static async ask(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showInformationMessage(message, ...actions)
  }

  public static info(message: string): void {
    void vscode.window.showInformationMessage(message)
  }

  public static error(message: string): void {
    void vscode.window.showErrorMessage(message)
  }

  public static async progress<T>(title: string, task: (report: Report) => Promise<T>): Promise<T> {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, async (progress: vscode.Progress<{ message?: string }>) =>
      task((message: Message) => { progress.report({ message: translate(message) }) }))
  }

  public static async openExternal(url: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(url))
  }

  public static async setContext(key: string, value: unknown): Promise<void> {
    await vscode.commands.executeCommand('setContext', key, value)
  }
}
