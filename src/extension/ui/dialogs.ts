/**
 * The small dialog helpers the controllers share.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Message } from '../../domain/model/message.model'
import { t, translate } from './l10n'

const DASHBOARD_COMMAND = 'warpengine.openDashboard'

/** A quick pick item that carries the value it stands for. */
export interface PickItem<T> extends vscode.QuickPickItem {
  /** The value {@link Dialogs.pick} returns when the item is chosen. */
  readonly value: T
}

/** Reports a step of a long task, shown as the message of the progress notification. */
export type Report = (message: Message) => void

/** Static wrappers around `vscode.window` and friends: quick picks, input boxes, messages, progress, links and context keys. */
export class Dialogs {
  /**
   * Shows a quick pick.
   *
   * @param items - The items with their values.
   * @param options - The quick pick options, such as the title.
   * @returns The value of the chosen item, or `undefined` when the pick is dismissed.
   */
  public static async pick<T>(items: readonly PickItem<T>[], options: vscode.QuickPickOptions): Promise<T | undefined> {
    return (await vscode.window.showQuickPick(items, options))?.value
  }

  /**
   * Shows an input box.
   *
   * @param options - The input box options, such as the title, value and validation.
   * @returns The text entered, or `undefined` when the box is dismissed.
   */
  public static async input(options: vscode.InputBoxOptions): Promise<string | undefined> {
    return vscode.window.showInputBox(options)
  }

  /**
   * Asks a yes-or-no question as a modal warning.
   *
   * @param message - The question.
   * @param action - The label of the confirming button.
   * @returns `true` when the button is pressed, `false` when the dialog is cancelled.
   */
  public static async confirm(message: string, action: string): Promise<boolean> {
    return (await vscode.window.showWarningMessage(message, { modal: true }, action)) === action
  }

  /**
   * Shows an information message with buttons.
   *
   * @param message - The message.
   * @param actions - The button labels.
   * @returns The label pressed, or `undefined` when the message is dismissed.
   */
  public static async ask(message: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showInformationMessage(message, ...actions)
  }

  /**
   * Shows an information message without waiting for it.
   *
   * @param message - The message.
   */
  public static info(message: string): void {
    void vscode.window.showInformationMessage(message)
  }

  /**
   * Shows an error message with actions, and *Open Dashboard* after them, and waits for the answer; *Open Dashboard*
   * opens the Dashboard (`warpengine.openDashboard`).
   *
   * @param message - The message.
   * @param actions - The button labels.
   * @returns The label of the clicked action, or `undefined` when dismissed or *Open Dashboard* was clicked.
   */
  public static async alert(message: string, ...actions: string[]): Promise<string | undefined> {
    const dashboard: string = t('Open Dashboard')
    const answer: string | undefined = await vscode.window.showErrorMessage(message, ...actions, dashboard)
    if (answer !== dashboard) return answer
    await vscode.commands.executeCommand(DASHBOARD_COMMAND)
    return undefined
  }

  /**
   * Shows an error message with *Open Dashboard* without waiting for it.
   *
   * @param message - The message.
   */
  public static error(message: string): void {
    void Dialogs.alert(message)
  }

  /**
   * Runs a task under a progress notification.
   *
   * @param title - The notification's title.
   * @param task - The work; the {@link Report} it gets translates a step's message and shows it.
   * @returns What the task returns.
   */
  public static async progress<T>(title: string, task: (report: Report) => Promise<T>): Promise<T> {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, async (progress: vscode.Progress<{ message?: string }>) =>
      task((message: Message) => { progress.report({ message: translate(message) }) }))
  }

  /**
   * Opens a URL outside VS Code, usually in the browser.
   *
   * @param url - The URL.
   */
  public static async openExternal(url: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(url))
  }

  /**
   * Sets a context key for `when` clauses (the `setContext` command).
   *
   * @param key - The key, such as `warpengine.isProject`.
   * @param value - The value.
   */
  public static async setContext(key: string, value: unknown): Promise<void> {
    await vscode.commands.executeCommand('setContext', key, value)
  }
}
