/**
 * The {@link domain/repository/shell.repository!ShellRepository} port implemented with a child process.
 *
 * @module
 */
import type { ShellRepository, ShellResult } from '../../domain/repository/shell.repository'
import { ProcessRunner } from './process.runner'

/**
 * Runs command lines in the system shell through {@link infrastructure/process/process.runner!ProcessRunner.shell}.
 */
export class ProcessShellRepository implements ShellRepository {
  /**
   * Runs a command line in the system shell.
   *
   * @param commandLine - The line to run.
   * @param cwd - The folder it runs in.
   * @returns The exit code and the output; never rejects.
   */
  public async run(commandLine: string, cwd: string): Promise<ShellResult> {
    return ProcessRunner.shell(commandLine, cwd)
  }
}
