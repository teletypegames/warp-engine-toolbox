/**
 * Port to the local container runtime (Docker) behind the Local Server view and the purge.
 *
 * @module
 */
import type { ServerContainer } from '../model/server.model'

/** Whether Docker can be used: `ok`, `missing` (no Docker command) or `down` (the command runs, the daemon does not answer). */
export type DockerAvailability = 'ok' | 'missing' | 'down'

/** The kinds of Docker object {@link ContainerRuntime.remove} can delete. */
export type DockerObject = 'container' | 'volume' | 'network' | 'image'

/**
 * Port to the local container runtime: lists and removes the containers, volumes, networks and
 * images of the local WarpEngine components.
 *
 * The members that query reject with an `Error` carrying the runtime's message when its command fails.
 */
export interface ContainerRuntime {
  /**
   * Tells whether Docker can be used, without rejecting.
   *
   * @returns `ok`, `missing` or `down`.
   */
  availability(): Promise<DockerAvailability>
  /**
   * Opens the Docker desktop application of this computer (OrbStack or Docker Desktop on macOS, Docker Desktop on
   * Windows), which starts the daemon.
   *
   * @returns `true` when one was opened; `false` when there is none to open (Linux: the service is started in a terminal).
   */
  launchDesktop(): Promise<boolean>
  /**
   * Lists all containers, running or not, that carry a label.
   *
   * @param label - The label filter, `key` or `key=value`.
   * @returns The containers with their state and published host ports.
   */
  containers(label: string): Promise<ServerContainer[]>
  /**
   * Lists the volumes that carry a label.
   *
   * @param label - The label filter, `key` or `key=value`.
   * @returns The volume names.
   */
  volumes(label: string): Promise<string[]>
  /**
   * Lists the networks that carry a label.
   *
   * @param label - The label filter, `key` or `key=value`.
   * @returns The network names.
   */
  networks(label: string): Promise<string[]>
  /**
   * Lists the tagged local images matching a reference.
   *
   * @param reference - The image reference or pattern, e.g. `ghcr.io/org/name`.
   * @returns The images as `repository:tag`; untagged ones are left out.
   */
  images(reference: string): Promise<string[]>
  /**
   * Finds the host folder mounted into a container at a path.
   *
   * @param container - The container name or id.
   * @param destination - The mount point inside the container.
   * @returns The host path, or `null` when nothing is mounted there.
   */
  mountSource(container: string, destination: string): Promise<string | null>
  /**
   * Starts stopped containers; a name that fails is skipped silently.
   *
   * @param names - The container names or ids; empty does nothing.
   */
  start(names: readonly string[]): Promise<void>
  /**
   * Stops containers, keeping them; a name that fails is skipped silently.
   *
   * @param names - The container names or ids; empty does nothing.
   */
  stop(names: readonly string[]): Promise<void>
  /**
   * Restarts containers; a name that fails is skipped silently.
   *
   * @param names - The container names or ids; empty does nothing.
   */
  restart(names: readonly string[]): Promise<void>
  /**
   * Removes Docker objects one by one, containers and volumes forcibly; a name that fails is skipped silently.
   *
   * @param kind - What the names are.
   * @param names - The names to remove; empty does nothing.
   */
  remove(kind: DockerObject, names: readonly string[]): Promise<void>
  /**
   * Empties a host folder through a throwaway container (so files owned by the container user go too), then deletes
   * the folder; without an image it deletes the folder directly.
   *
   * @throws When the container cannot run.
   *
   * @param hostPath - The folder on the host.
   * @param image - An image with a shell to run the deletion in, or `null` to delete without a container.
   */
  wipeFolder(hostPath: string, image: string | null): Promise<void>
}
