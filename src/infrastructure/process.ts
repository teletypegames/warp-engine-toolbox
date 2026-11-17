import { execFile, spawn } from 'node:child_process'

export interface RunResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export async function run(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<RunResult> {
  return new Promise((resolve: (result: RunResult) => void) => {
    execFile(command, [...args], { cwd, env, maxBuffer: 32 * 1024 * 1024 }, (error: Error | null, stdout: string, stderr: string) => {
      const code: number = error && 'code' in error && typeof error.code === 'number' ? error.code : error ? 1 : 0
      resolve({ code, stdout, stderr: stderr || (error && code !== 0 && !stderr ? error.message : stderr) })
    })
  })
}

export async function runOrThrow(command: string, args: readonly string[], cwd: string): Promise<string> {
  const result: RunResult = await run(command, args, cwd)
  if (result.code !== 0) throw new Error(`${command} ${args.join(' ')}: ${result.stderr.trim() || `exit ${String(result.code)}`}`)
  return result.stdout
}

export async function shell(commandLine: string, cwd: string): Promise<RunResult> {
  return new Promise((resolve: (result: RunResult) => void) => {
    const child = spawn(commandLine, { cwd, shell: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', (error: Error) => { resolve({ code: 1, stdout, stderr: error.message }) })
    child.on('close', (code: number | null) => { resolve({ code: code ?? 1, stdout, stderr }) })
  })
}
