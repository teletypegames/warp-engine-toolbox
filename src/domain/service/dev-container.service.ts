/**
 * The dev container of a project: whether its commands run in it, and running, building and stopping it.
 *
 * @module
 */
import { DevContainer } from '../model/dev-container.model'
import { FilePath } from '../model/path.model'
import type { DevContainerOutput, DevContainerRepository, DevContainerStart } from '../repository/dev-container.repository'
import type { FileSystemRepository } from '../repository/file-system.repository'

/**
 * Decides where a project's commands run and runs them in its dev container.
 *
 * A project with `.devcontainer/devcontainer.json` builds in its container: in a window reopened there the commands
 * run as they are, in a window on this computer they go through the Dev Containers CLI. The containers started that
 * way are stopped by {@link DevContainerService.stopStarted}.
 */
export class DevContainerService {
  private readonly started: Set<string> = new Set<string>()

  /**
   * Creates the service.
   *
   * @param containers - Starts, runs, builds and stops the dev containers.
   * @param files - Tells whether a project has a dev container.
   */
  public constructor(private readonly containers: DevContainerRepository, private readonly files: FileSystemRepository) {}

  /**
   * Tells whether this window runs inside a dev container.
   *
   * @returns `true` inside a dev container.
   */
  public inside(): boolean {
    return this.containers.inside()
  }

  /**
   * Tells whether a project folder has a dev container definition.
   *
   * @param folder - The project folder.
   * @returns `true` when `.devcontainer/devcontainer.json` exists.
   */
  public async has(folder: string): Promise<boolean> {
    return this.files.exists(FilePath.join(folder, DevContainer.FILE))
  }

  /**
   * Tells whether a project's commands go into its dev container from here: it has one and this window is not in it.
   *
   * @param folder - The project folder.
   * @returns `true` when the commands go through the Dev Containers CLI.
   */
  public async routes(folder: string): Promise<boolean> {
    return !this.inside() && this.has(folder)
  }

  /**
   * Runs a command in the project's dev container, starting the container first; a container it started (not one that
   * was running, such as a container window's) is remembered to stop it later.
   *
   * @param folder - The project folder.
   * @param command - The program and its arguments.
   * @param output - Receives the output.
   * @returns The exit code; `1` when the container does not start (the reason goes to the output).
   */
  public async run(folder: string, command: readonly string[], output: DevContainerOutput): Promise<number> {
    try {
      const start: DevContainerStart = await this.containers.up(folder, output)
      if (start.started) this.started.add(start.container)
    } catch (error: unknown) {
      output(`${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }
    return this.containers.exec(folder, command, output)
  }

  /**
   * Builds the image of the project's dev container on this computer.
   *
   * @param folder - The project folder.
   * @param output - Receives the build output.
   * @returns The exit code.
   */
  public async buildImage(folder: string, output: DevContainerOutput): Promise<number> {
    return this.containers.build(folder, output)
  }

  /**
   * Tells whether the Dev Containers extension would miss the Docker socket here.
   *
   * @returns `true` when the default socket is missing.
   */
  public async socketMissing(): Promise<boolean> {
    return this.containers.socketMissing()
  }

  /** Stops the containers this window started (they are kept for the next start); the ones it found running stay. */
  public async stopStarted(): Promise<void> {
    const ids: string[] = [...this.started]
    this.started.clear()
    await Promise.all(ids.map(async (id: string) => this.containers.stop(id)))
  }
}
