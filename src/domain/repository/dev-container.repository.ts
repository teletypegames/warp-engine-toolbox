/**
 * Port to the dev containers of the projects: starting one, running a command in it, building its image, stopping it.
 *
 * @module
 */

/** Receives the output of a dev container command as it comes, standard output and error mixed. */
export type DevContainerOutput = (text: string) => void

/** What {@link DevContainerRepository.up} gives back. */
export interface DevContainerStart {
  /** The container id. */
  readonly container: string
  /** `true` when the call started the container; `false` when it was running already. */
  readonly started: boolean
}

/** Port to the dev container tooling of this computer (the Dev Containers CLI and Docker). */
export interface DevContainerRepository {
  /**
   * Tells whether this process runs inside a dev container (a window reopened in the container).
   *
   * @returns `true` inside a dev container.
   */
  inside(): boolean
  /**
   * Starts the dev container of a folder, building its image first when needed; a running one is reused (such as
   * the container of a window reopened in it).
   *
   * @param folder - The project folder, which holds `.devcontainer/devcontainer.json`.
   * @param output - Receives the progress.
   * @returns The container and whether this call started it.
   * @throws When Docker or the definition fails.
   */
  up(folder: string, output: DevContainerOutput): Promise<DevContainerStart>
  /**
   * Runs a command in the folder's running dev container, in the project folder there.
   *
   * @param folder - The project folder.
   * @param command - The program and its arguments, such as `make build`.
   * @param output - Receives the output.
   * @returns The exit code.
   */
  exec(folder: string, command: readonly string[], output: DevContainerOutput): Promise<number>
  /**
   * Builds the image of the folder's dev container.
   *
   * @param folder - The project folder.
   * @param output - Receives the build output.
   * @returns The exit code.
   */
  build(folder: string, output: DevContainerOutput): Promise<number>
  /**
   * Stops a container; it is kept, and starts again quickly. A failure is ignored.
   *
   * @param container - The container id.
   */
  stop(container: string): Promise<void>
  /**
   * Tells whether the Docker socket the Dev Containers extension connects to is missing: no `DOCKER_HOST` and no
   * `/var/run/docker.sock`, as with OrbStack or Colima without their compatibility link.
   *
   * @returns `true` when it is missing; always `false` on Windows.
   */
  socketMissing(): Promise<boolean>
}
