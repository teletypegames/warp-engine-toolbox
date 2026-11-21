/**
 * The terminal of a `warpengine` task whose work runs in the extension: a dev container command, a Play.
 *
 * @module
 */
import * as vscode from 'vscode'

/** The work a {@link TaskTerminal} runs: it writes its output and resolves with the exit code. */
export type TaskWork = (output: (text: string) => void) => Promise<number>

/**
 * A pseudoterminal that runs one piece of work when the task starts, shows its output and closes with its exit code.
 *
 * A task with a custom execution reports no process exit, so the code also goes to the callback given here.
 */
export class TaskTerminal implements vscode.Pseudoterminal {
  private readonly writer: vscode.EventEmitter<string> = new vscode.EventEmitter<string>()
  private readonly closer: vscode.EventEmitter<number> = new vscode.EventEmitter<number>()
  /** Fires with the text to show; line ends are turned into the terminal's `\r\n`. */
  public readonly onDidWrite: vscode.Event<string> = this.writer.event
  /** Fires with the exit code when the work has ended. */
  public readonly onDidClose: vscode.Event<number> = this.closer.event

  /**
   * Creates the terminal.
   *
   * @param work - What to run when the terminal opens.
   * @param onExit - Receives the exit code, before the terminal closes.
   */
  public constructor(private readonly work: TaskWork, private readonly onExit: ((code: number) => void) | null = null) {}

  /** Starts the work when VS Code opens the terminal; an error becomes exit code `1` with its message shown. */
  public open(): void {
    void this.work((text: string) => { this.writer.fire(text.replace(/\r?\n/g, '\r\n')) })
      .catch((error: unknown) => {
        this.writer.fire(`${error instanceof Error ? error.message : String(error)}\r\n`)
        return 1
      })
      .then((code: number) => {
        this.onExit?.(code)
        this.closer.fire(code)
      })
  }

  /** Does nothing when the user closes the terminal: the work runs to its end. */
  public close(): void {
    this.writer.dispose()
  }
}
