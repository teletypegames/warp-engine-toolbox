/**
 * The Docker containers of the local WarpEngine and what a purge removes.
 *
 * @module
 */
/** What a local WarpEngine container does: the engine, Gitea, the Woodpecker server, a Woodpecker agent, or something else. */
export type ServerRole = 'engine' | 'git' | 'ci' | 'agent' | 'other'

/** A Docker container of the local WarpEngine stack, as the Local Server view lists it. */
export interface ServerContainer {
  /** The container id. */
  readonly id: string
  /** The container name. */
  readonly name: string
  /** The image the container runs. */
  readonly image: string
  /** The Docker state, such as `running` or `exited`. */
  readonly state: string
  /** Docker's human-readable status, such as `Up 2 hours`. */
  readonly status: string
  /** The host ports the container publishes. */
  readonly hostPorts: readonly number[]
  /** The project folder of a dev container (its `devcontainer.local_folder` label); `null` for other containers. */
  readonly folder: string | null
}

/** What a purge of the local WarpEngine removes. */
export interface PurgePlan {
  /** The containers to remove. */
  readonly containers: readonly ServerContainer[]
  /** The Docker volumes to remove. */
  readonly volumes: readonly string[]
  /** The Docker networks to remove. */
  readonly networks: readonly string[]
  /** The images to remove. */
  readonly images: readonly string[]
  /** The host folder mounted as the engine's data, to delete, or `null`. */
  readonly dataFolder: string | null
}

/** What removing the projects' dev containers removes. */
export interface DevContainerPlan {
  /** The dev containers, running or not. */
  readonly containers: readonly ServerContainer[]
  /** The images they were built from. */
  readonly images: readonly string[]
  /** The named volumes they mount (such as a `node_modules` volume). */
  readonly volumes: readonly string[]
}

/** Rules and names for the containers of the local WarpEngine. */
export class Servers {
  /** The Docker label every local WarpEngine container, volume and network carries. */
  public static readonly LABEL: string = 'org.teletypegames.warp-engine.local=1'
  /** The engine container's name. */
  public static readonly ENGINE: string = 'warp-engine-local'
  /** The engine image's repository. */
  public static readonly ENGINE_IMAGE: string = 'git.teletypegames.org/build/warp-engine-local'
  /** The path in the engine container where its data folder is mounted. */
  public static readonly DATA_MOUNT: string = '/data'
  /** The label the Dev Containers tooling puts on a project's dev container, with the project folder as its value. */
  public static readonly DEV_CONTAINER_LABEL: string = 'devcontainer.local_folder'

  /**
   * Tells what a container does from its name.
   * @param container - The container.
   * @returns Its role.
   */
  public static role(container: ServerContainer): ServerRole {
    if (container.name === Servers.ENGINE) return 'engine'
    if (container.name.endsWith('-gitea')) return 'git'
    if (container.name.endsWith('-woodpecker-agent')) return 'agent'
    return container.name.endsWith('-woodpecker') ? 'ci' : 'other'
  }

  /**
   * Gives the address of a running container's web interface.
   * @param container - The container.
   * @returns `http://127.0.0.1:<port>` for the engine, `http://localhost:<port>` for the others, or `null` when it is not running or publishes no port.
   */
  public static url(container: ServerContainer): string | null {
    const port: number | undefined = container.hostPorts[0]
    if (port === undefined || container.state !== 'running') return null
    return Servers.role(container) === 'engine' ? `http://127.0.0.1:${String(port)}` : `http://localhost:${String(port)}`
  }

  /**
   * Picks the containers that do not run.
   * @param containers - The containers.
   * @returns Their names.
   */
  public static stopped(containers: readonly ServerContainer[]): string[] {
    return containers.filter((container: ServerContainer) => container.state !== 'running').map((container: ServerContainer) => container.name)
  }

  /**
   * Orders containers by role: engine, git, CI, agent, other.
   * @param containers - The containers.
   * @returns A new sorted array.
   */
  public static sorted(containers: readonly ServerContainer[]): ServerContainer[] {
    const order: readonly ServerRole[] = ['engine', 'git', 'ci', 'agent', 'other']
    return [...containers].sort((a: ServerContainer, b: ServerContainer) => order.indexOf(Servers.role(a)) - order.indexOf(Servers.role(b)))
  }

  /**
   * Guards the data folder a purge may delete.
   * @param folder - The engine's data folder on the host, or `null`.
   * @returns The folder when it is at least two levels deep, else `null`, so a root or top-level folder is never deleted.
   */
  public static wipeable(folder: string | null): string | null {
    if (!folder) return null
    return folder.split(/[\\/]/).filter(Boolean).length >= 2 ? folder : null
  }

  /**
   * Tells whether a purge has nothing to remove.
   * @param plan - The purge plan.
   * @returns `true` when the plan has no containers, volumes, networks, images or data folder.
   */
  public static isEmpty(plan: PurgePlan): boolean {
    return plan.containers.length + plan.volumes.length + plan.networks.length + plan.images.length === 0 && plan.dataFolder === null
  }
}
