/**
 * The buttons that put a failure or a missing setup right: a {@link domain/model/message.model!Remedy} as a VS Code command.
 *
 * @module
 */
import * as vscode from 'vscode'
import { HostError } from '../../domain/model/host-error.model'
import { DomainError, type Remedy } from '../../domain/model/message.model'
import { Dialogs } from './dialogs'
import { errorText, t } from './l10n'

const COMMANDS: Readonly<Record<Remedy, string>> = {
  selectHost: 'warpengine.selectHost',
  signIn: 'warpengine.signIn',
  reauthorize: 'warpengine.reauthorize',
  installLocalEngine: 'warpengine.installLocalEngine',
  connect: 'warpengine.connect',
  setupLocalCi: 'warpengine.setupLocalCi',
  editMetadata: 'warpengine.editMetadata',
  addToProject: 'warpengine.addToProject',
  newGame: 'warpengine.newGame'
}

const LABELS: Readonly<Record<Remedy, () => string>> = {
  selectHost: () => t('Set Host…'),
  signIn: () => t('Sign in'),
  reauthorize: () => t('Sign In Again'),
  installLocalEngine: () => t('Install a local engine'),
  connect: () => t('Connect'),
  setupLocalCi: () => t('Set up local CI'),
  editMetadata: () => t('Edit Metadata'),
  addToProject: () => t('Add WarpEngine to This Project'),
  newGame: () => t('New Game…')
}

/** Turns remedies into buttons and commands. */
export class RemedyDialog {
  /**
   * Gives the button text of a remedy, in the display language.
   *
   * @param remedy - The remedy.
   * @returns The label.
   */
  public static label(remedy: Remedy): string {
    return LABELS[remedy]()
  }

  /**
   * Gives the VS Code command that performs a remedy.
   *
   * @param remedy - The remedy.
   * @returns The command, titled with {@link RemedyDialog.label}.
   */
  public static command(remedy: Remedy): vscode.Command {
    return { title: RemedyDialog.label(remedy), command: COMMANDS[remedy] }
  }

  /**
   * Finds the remedy of a failure: the one a {@link domain/model/message.model!DomainError} carries, or signing in
   * again when the host refused the token.
   *
   * @param error - The failure.
   * @returns The remedy, or `null` when there is none.
   */
  public static of(error: unknown): Remedy | null {
    if (error instanceof DomainError) return error.remedy
    return HostError.isUnauthorized(error) ? 'reauthorize' : null
  }

  /**
   * Shows a failure as an error message; when it has a remedy, with its button, and runs the remedy when clicked.
   *
   * @param error - The failure.
   * @param prefix - Put before the error text, such as `WarpEngine: `.
   */
  public static async report(error: unknown, prefix: string = ''): Promise<void> {
    const remedy: Remedy | null = RemedyDialog.of(error)
    const text = `${prefix}${errorText(error)}`
    if (!remedy) {
      Dialogs.error(text)
      return
    }
    const label: string = RemedyDialog.label(remedy)
    if ((await Dialogs.alert(text, label)) === label) await vscode.commands.executeCommand(COMMANDS[remedy])
  }
}
