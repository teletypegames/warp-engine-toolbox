/**
 * Registers the toolbox commands with one error handler.
 *
 * @module
 */
import * as vscode from 'vscode'
import { RemedyDialog } from '../ui/remedy.dialog'

/** The function a command runs: a controller method, given the command's arguments. */
export type CommandHandler = (...args: never[]) => Promise<void>

/**
 * Registers command rows with VS Code, each wrapped in the shared error handler.
 */
export class CommandRegistry {
  /**
   * Registers each row as a VS Code command.
   *
   * A handler that throws shows `WarpEngine: <message>` as an error notification, the
   * message translated when it is a `DomainError`; a `vscode.CancellationError` is ignored.
   *
   * @param rows - Pairs of command id and handler.
   * @returns The registrations, to dispose on deactivation.
   */
  public static register(rows: readonly (readonly [string, CommandHandler])[]): vscode.Disposable[] {
    return rows.map(([id, handler]: readonly [string, CommandHandler]) => vscode.commands.registerCommand(id, CommandRegistry.guarded(handler)))
  }

  private static guarded(handler: CommandHandler): CommandHandler {
    return async (...args: never[]): Promise<void> => {
      try {
        await handler(...args)
      } catch (error: unknown) {
        if (!(error instanceof vscode.CancellationError)) void RemedyDialog.report(error, 'WarpEngine: ')
      }
    }
  }
}
