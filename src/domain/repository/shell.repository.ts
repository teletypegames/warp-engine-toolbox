/**
 * Port that runs shell command lines.
 *
 * @module
 */
/** The outcome of a finished command. */
export interface ShellResult {
  /** The exit code; `0` is success. */
  readonly code: number
  /** Everything the command wrote to standard output. */
  readonly stdout: string
  /** Everything the command wrote to standard error, or why it could not start. */
  readonly stderr: string
}

/** Port that runs a command line in the user's shell. */
export interface ShellRepository {
  /**
   * Runs a command line through the shell and waits for it. Never rejects; a command that cannot start ends with a non-zero code.
   *
   * @param commandLine - The line, as typed in a shell.
   * @param cwd - The working folder.
   * @returns The exit code and output.
   */
  run(commandLine: string, cwd: string): Promise<ShellResult>
}
