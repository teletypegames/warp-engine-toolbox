/**
 * The small dialog helpers the controllers share.
 *
 * @module
 */
import * as vscode from 'vscode'
import { DevContainer } from '../../domain/model/dev-container.model'
import type { Message } from '../../domain/model/message.model'
import { TypedConfirmation } from '../../domain/model/typed-confirmation.model'
import { t, translate } from './l10n'

const DASHBOARD_COMMAND = 'warpengine.openDashboard'

/** A quick pick item that carries the value it stands for. */
export interface PickItem<T> extends vscode.QuickPickItem {
  /** The value {@link Dialogs.pick} returns when the item is chosen. */
  readonly value: T
}

/** A button on a quick pick item: the action it stands for and how it looks. */
export interface PickAction {
  /** The action {@link Dialogs.pickWithActions} returns when the button is pressed. */
  readonly id: string
  /** The codicon of the button, such as `edit` or `trash`. */
  readonly icon: string
  /** The tooltip of the button. */
  readonly tooltip: string
}

/** A quick pick item with buttons of its own. */
export interface ActionPickItem<T> extends PickItem<T> {
  /** The buttons of the item; none when left out. */
  readonly actions?: readonly PickAction[]
}

/** What {@link Dialogs.pickWithActions} answers: the value of the item, and the action of the button when one was pressed instead of the item. */
export interface PickAnswer<T> {
  /** The value of the item. */
  readonly value: T
  /** The id of the button pressed on the item; `undefined` when the item itself was chosen. */
  readonly action?: string
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
   * Shows a quick pick whose items may carry buttons (edit, remove…): choosing an item or pressing one of its buttons closes it.
   *
   * @param items - The items with their values and buttons.
   * @param options - The title and the placeholder.
   * @returns The value chosen and the button pressed, or `undefined` when the pick is dismissed.
   */
  public static async pickWithActions<T>(items: readonly ActionPickItem<T>[], options: { readonly title: string; readonly placeHolder: string }): Promise<PickAnswer<T> | undefined> {
    const quick: vscode.QuickPick<ActionPickItem<T>> = vscode.window.createQuickPick<ActionPickItem<T>>()
    const buttons: Map<vscode.QuickInputButton, string> = new Map<vscode.QuickInputButton, string>()
    quick.title = options.title
    quick.placeholder = options.placeHolder
    quick.items = items.map((item: ActionPickItem<T>) => ({ ...item, buttons: Dialogs.buttonsOf(item, buttons) }))
    return new Promise((resolve: (answer: PickAnswer<T> | undefined) => void) => {
      let answer: PickAnswer<T> | undefined
      quick.onDidAccept(() => {
        answer = quick.selectedItems[0] ? { value: quick.selectedItems[0].value } : undefined
        quick.hide()
      })
      quick.onDidTriggerItemButton((event: vscode.QuickPickItemButtonEvent<ActionPickItem<T>>) => {
        answer = { value: event.item.value, action: buttons.get(event.button) }
        quick.hide()
      })
      quick.onDidHide(() => { quick.dispose(); resolve(answer) })
      quick.show()
    })
  }

  private static buttonsOf<T>(item: ActionPickItem<T>, buttons: Map<vscode.QuickInputButton, string>): vscode.QuickInputButton[] {
    return (item.actions ?? []).map((action: PickAction) => {
      const button: vscode.QuickInputButton = { iconPath: new vscode.ThemeIcon(action.icon), tooltip: action.tooltip }
      buttons.set(button, action.id)
      return button
    })
  }

  /**
   * Shows a quick pick where several items can be chosen.
   *
   * @param items - The items with their values.
   * @param options - The quick pick options, such as the title.
   * @returns The values of the chosen items, or `undefined` when the pick is dismissed.
   */
  public static async pickMany<T>(items: readonly PickItem<T>[], options: vscode.QuickPickOptions): Promise<T[] | undefined> {
    return (await vscode.window.showQuickPick(items, { ...options, canPickMany: true }))?.map((item: PickItem<T>) => item.value)
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
   * Asks the user to type a name to confirm a destructive action, in an input box that stays open until it is dismissed or the name is typed exactly.
   *
   * @param title - The title of the input box, naming the action.
   * @param prompt - The explanation under the box: what happens and what to type.
   * @param expected - The name that confirms ({@link domain/model/typed-confirmation.model!TypedConfirmation}).
   * @param mismatch - The validation message shown while the text typed is not the name.
   * @returns `true` only when the exact name was entered; `false` when the box is dismissed.
   */
  public static async confirmByTyping(title: string, prompt: string, expected: string, mismatch: string): Promise<boolean> {
    const confirmation: TypedConfirmation = new TypedConfirmation(expected)
    const typed: string | undefined = await vscode.window.showInputBox({
      title,
      prompt,
      placeHolder: expected,
      ignoreFocusOut: true,
      validateInput: (value: string): string | undefined => value === '' || confirmation.matches(value) ? undefined : mismatch
    })
    return confirmation.matches(typed)
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
   * Shows a modal warning with a detail line and actions, and waits for the answer.
   *
   * @param message - The message.
   * @param detail - The line under it.
   * @param actions - The button labels.
   * @returns The label pressed, or `undefined` when cancelled.
   */
  public static async choose(message: string, detail: string, ...actions: string[]): Promise<string | undefined> {
    return vscode.window.showWarningMessage(message, { modal: true, detail }, ...actions)
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
   * Opens a URL outside VS Code, usually in the browser; from a dev container a link to the computer's loopback opens
   * on the computer, not through a port forwarded into the container ({@link domain/model/dev-container.model!DevContainer.browserUrl}).
   *
   * @param url - The URL.
   */
  public static async openExternal(url: string): Promise<void> {
    const target: string = vscode.env.remoteName?.includes('container') ? DevContainer.browserUrl(url) : url
    await vscode.env.openExternal(vscode.Uri.parse(target))
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
