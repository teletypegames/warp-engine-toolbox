export interface ShellResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export interface ShellRepository {
  run(commandLine: string, cwd: string): Promise<ShellResult>
}
