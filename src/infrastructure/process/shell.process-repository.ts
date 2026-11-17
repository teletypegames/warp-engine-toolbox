import type { ShellRepository, ShellResult } from '../../domain/repository/shell.repository'
import { ProcessRunner } from './process.runner'

export class ProcessShellRepository implements ShellRepository {
  public async run(commandLine: string, cwd: string): Promise<ShellResult> {
    return ProcessRunner.shell(commandLine, cwd)
  }
}
