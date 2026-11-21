/**
 * The dev containers through the Dev Containers CLI bundled with the toolbox, run on the editor's own Node.
 *
 * @module
 */
import { execFile, spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import type { DevContainerOutput, DevContainerRepository, DevContainerStart } from '../../domain/repository/dev-container.repository'
import { Loopback } from '../http/loopback'

const DEFAULT_SOCKET = '/var/run/docker.sock'
const LOCAL_FOLDER_LABEL = 'devcontainer.local_folder'

/** Where the bundled CLI is and which programs run it. */
export interface DevContainerCliOptions {
  /** The bundled `devcontainer.js` of `@devcontainers/cli`. */
  readonly cli: string
  /** The Node that runs it: the editor's own (`process.execPath` with `ELECTRON_RUN_AS_NODE=1`). */
  readonly node: string
  /** Gives the Docker CLI to use (the `warpengine.docker` setting), read on each call. */
  readonly docker: () => string
}

/**
 * {@link domain/repository/dev-container.repository!DevContainerRepository} on the bundled `@devcontainers/cli`.
 *
 * The CLI runs on the editor's Electron as Node, so the computer needs Docker only. It uses the Docker CLI's own
 * context (OrbStack, Colima, Docker Desktop alike) and the same labels as the Dev Containers extension, so a
 * container started here is the one a window reopened in the container uses.
 */
export class CliDevContainerRepository implements DevContainerRepository {
  /**
   * Creates the repository.
   *
   * @param options - The bundled CLI, the Node that runs it and the Docker CLI.
   */
  public constructor(private readonly options: DevContainerCliOptions) {}

  /**
   * Tells whether this process runs in a dev container: the template's variable or the one the Dev Containers extension sets.
   *
   * @returns `true` inside a dev container.
   */
  public inside(): boolean {
    return Loopback.inDevContainer()
  }

  /**
   * Runs `devcontainer up` for the folder and reads the container id from its JSON result; asks Docker first whether
   * the folder's container (by the Dev Containers label) was running already.
   *
   * @param folder - The project folder.
   * @param output - Receives the CLI's log.
   * @returns The container id and whether this call started it.
   * @throws Error with the CLI's message when the outcome is not a success.
   */
  public async up(folder: string, output: DevContainerOutput): Promise<DevContainerStart> {
    const running: string[] = await this.running(folder)
    let result = ''
    const code: number = await this.cli(['up', ...this.common(folder)], (text: string, stream: 'out' | 'err') => {
      if (stream === 'out') result += text
      else output(text)
    })
    const parsed: { outcome?: unknown; containerId?: unknown; message?: unknown } = CliDevContainerRepository.lastJson(result)
    if (code !== 0 || parsed.outcome !== 'success' || typeof parsed.containerId !== 'string') {
      throw new Error(typeof parsed.message === 'string' ? parsed.message : `devcontainer up failed (exit ${String(code)})`)
    }
    const container: string = parsed.containerId
    return { container, started: !running.some((id: string) => container.startsWith(id)) }
  }

  /**
   * Runs `devcontainer exec` with the command in the folder's container.
   *
   * @param folder - The project folder.
   * @param command - The program and its arguments.
   * @param output - Receives the command's output.
   * @returns The exit code.
   */
  public async exec(folder: string, command: readonly string[], output: DevContainerOutput): Promise<number> {
    return this.cli(['exec', ...this.common(folder), ...command], (text: string) => { output(text) })
  }

  /**
   * Runs `devcontainer build` for the folder.
   *
   * @param folder - The project folder.
   * @param output - Receives the build output.
   * @returns The exit code.
   */
  public async build(folder: string, output: DevContainerOutput): Promise<number> {
    return this.cli(['build', ...this.common(folder)], (text: string) => { output(text) })
  }

  /**
   * Runs `docker stop` on the container; a failure is ignored.
   *
   * @param container - The container id.
   */
  public async stop(container: string): Promise<void> {
    await new Promise<void>((done: () => void) => { execFile(this.options.docker(), ['stop', container], () => { done() }) })
  }

  /**
   * Checks for `/var/run/docker.sock` when `DOCKER_HOST` is not set.
   *
   * @returns `true` when the socket is missing; `false` on Windows.
   */
  public async socketMissing(): Promise<boolean> {
    if (process.platform === 'win32' || process.env['DOCKER_HOST']) return false
    return access(DEFAULT_SOCKET).then(() => false, () => true)
  }

  private async running(folder: string): Promise<string[]> {
    return new Promise((resolve: (ids: string[]) => void) => {
      execFile(this.options.docker(), ['ps', '-q', '--no-trunc', '--filter', `label=${LOCAL_FOLDER_LABEL}=${folder}`], (error: Error | null, stdout: string) => {
        resolve(error ? [] : stdout.split('\n').map((line: string) => line.trim()).filter(Boolean))
      })
    })
  }

  private common(folder: string): string[] {
    return ['--workspace-folder', folder, '--docker-path', this.options.docker()]
  }

  private async cli(args: readonly string[], output: (text: string, stream: 'out' | 'err') => void): Promise<number> {
    return new Promise((resolve: (code: number) => void) => {
      const child = spawn(this.options.node, [this.options.cli, ...args], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } })
      child.stdout.on('data', (chunk: Buffer) => { output(chunk.toString(), 'out') })
      child.stderr.on('data', (chunk: Buffer) => { output(chunk.toString(), 'err') })
      child.on('error', (error: Error) => { output(`${error.message}\n`, 'err'); resolve(1) })
      child.on('close', (code: number | null) => { resolve(code ?? 1) })
    })
  }

  private static lastJson(text: string): { outcome?: unknown; containerId?: unknown; message?: unknown } {
    const line: string | undefined = text.trim().split('\n').reverse().find((candidate: string) => candidate.trim().startsWith('{'))
    try {
      const value: unknown = line ? JSON.parse(line) : {}
      return typeof value === 'object' && value !== null ? value : {}
    } catch {
      return {}
    }
  }
}
