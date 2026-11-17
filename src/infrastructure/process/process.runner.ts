import { execFile, spawn } from 'node:child_process'
import type { ShellResult } from '../../domain/repository/shell.repository'

const MAX_BUFFER = 32 * 1024 * 1024

export class ProcessRunner {
  public static async run(command: string, args: readonly string[], cwd: string): Promise<ShellResult> {
    return new Promise((resolve: (result: ShellResult) => void) => {
      execFile(command, [...args], { cwd, env: process.env, maxBuffer: MAX_BUFFER }, (error: Error | null, stdout: string, stderr: string) => {
        const code: number = ProcessRunner.exitCode(error)
        resolve({ code, stdout, stderr: stderr || (error && code !== 0 ? error.message : stderr) })
      })
    })
  }

  public static async runOrThrow(command: string, args: readonly string[], cwd: string): Promise<string> {
    const result: ShellResult = await ProcessRunner.run(command, args, cwd)
    if (result.code !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr.trim() || `exit ${String(result.code)}`}`)
    return result.stdout
  }

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
