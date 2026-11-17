import * as vscode from 'vscode'
import { Dialogs } from '../ui/dialogs'
import { errorText } from '../ui/l10n'

export type CommandHandler = (...args: never[]) => Promise<void>

export class CommandRegistry {
  public static register(rows: readonly (readonly [string, CommandHandler])[]): vscode.Disposable[] {
    return rows.map(([id, handler]: readonly [string, CommandHandler]) => vscode.commands.registerCommand(id, CommandRegistry.guarded(handler)))
  }

  private static guarded(handler: CommandHandler): CommandHandler {
    return async (...args: never[]): Promise<void> => {
      try {
        await handler(...args)
      } catch (error: unknown) {
        if (!(error instanceof vscode.CancellationError)) Dialogs.error(`WarpEngine: ${errorText(error)}`)
      }
    }
  }
}
