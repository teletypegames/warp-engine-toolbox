/**
 * Running external programs: a command with arguments, or a shell line.
 *
 * @module
 */
import { execFile, spawn } from 'node:child_process'
import type { ShellResult } from '../../domain/repository/shell.repository'

const MAX_BUFFER = 32 * 1024 * 1024

/**
 * Static helpers that run a child process with the extension's environment and collect its output.
 */
export class ProcessRunner {
  /**
   * Runs a program with arguments through `execFile`, without a shell; output beyond 32 MB fails the run.
   *
   * @param command - The program, such as `git` or `docker`.
   * @param args - Its arguments.
   * @param cwd - The folder it runs in.
   * @returns The exit code, standard output and standard error; never rejects, a program that
   *   cannot start gives a non-zero code with the error message as standard error.
   */
  public static async run(command: string, args: readonly string[], cwd: string): Promise<ShellResult> {
    return new Promise((resolve: (result: ShellResult) => void) => {
      execFile(command, [...args], { cwd, env: process.env, maxBuffer: MAX_BUFFER }, (error: Error | null, stdout: string, stderr: string) => {
        const code: number = ProcessRunner.exitCode(error)
        resolve({ code, stdout, stderr: stderr || (error && code !== 0 ? error.message : stderr) })
      })
    })
  }

  /**
   * Runs a program like {@link ProcessRunner.run} and fails when it exits non-zero.
   *
   * @param command - The program.
   * @param args - Its arguments.
   * @param cwd - The folder it runs in.
   * @returns The standard output.
   * @throws `Error` naming the command line, with the standard error or the exit code.
   */
  public static async runOrThrow(command: string, args: readonly string[], cwd: string): Promise<string> {
    const result: ShellResult = await ProcessRunner.run(command, args, cwd)
    if (result.code !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr.trim() || `exit ${String(result.code)}`}`)
    return result.stdout
  }

  /**
   * Runs a command line in the system shell (`spawn` with `shell: true`).
   *
   * @param commandLine - The line, with pipes and redirections as the shell allows.
   * @param cwd - The folder it runs in.
   * @returns The exit code (`1` when the shell cannot start or is killed), standard output and standard error; never rejects.
   */
  public static async shell(commandLine: string, cwd: string): Promise<ShellResult> {
    return new Promise((resolve: (result: ShellResult) => void) => {
      const child = spawn(commandLine, { cwd, shell: true })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      child.on('error', (error: Error) => { resolve({ code: 1, stdout, stderr: error.message }) })
      child.on('close', (code: number | null) => { resolve({ code: code ?? 1, stdout, stderr }) })
    })
  }

  private static exitCode(error: Error | null): number {
    if (!error) return 0
    return 'code' in error && typeof error.code === 'number' ? error.code : 1
  }
}
