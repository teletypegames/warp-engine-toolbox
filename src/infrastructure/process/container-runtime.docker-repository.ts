/**
 * The {@link domain/repository/container-runtime.repository!ContainerRuntime} port implemented with the `docker` command line.
 *
 * @module
 */
import { access, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import type { ServerContainer } from '../../domain/model/server.model'
import type { ContainerRuntime, DockerAvailability, DockerObject } from '../../domain/repository/container-runtime.repository'
import type { ShellResult } from '../../domain/repository/shell.repository'
import { ProcessRunner } from './process.runner'

interface PsRow {
  readonly id: string
  readonly name: string
  readonly image: string
  readonly state: string
  readonly status: string
  readonly ports: string
  readonly folder: string
}

const MAC_APPS: readonly (readonly [string, string])[] = [['/Applications/OrbStack.app', 'OrbStack'], ['/Applications/Docker.app', 'Docker']]
const WINDOWS_DESKTOP = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'

const PS_FORMAT = '{"id":{{json .ID}},"name":{{json .Names}},"image":{{json .Image}},"state":{{json .State}},"status":{{json .Status}},"ports":{{json .Ports}},"folder":{{json (.Label "devcontainer.local_folder")}}}'

/**
 * Runs the Docker CLI, in the home folder, for the Local Server view and the purge of WarpEngine Local.
 *
 * The queries throw an `Error` with docker's standard error when the command exits non-zero.
 */
export class DockerContainerRuntime implements ContainerRuntime {
  /**
   * Creates the runtime.
   *
   * @param binary - Gives the docker executable to run (the `warpengine.docker` setting), read on every call.
   */
  public constructor(private readonly binary: () => string) {}

  /**
   * Tells whether Docker can be used: `docker version` answers (`ok`), the command cannot start (`missing`), or it
   * runs but the daemon does not answer (`down`).
   *
   * @returns The availability.
   */
  public async availability(): Promise<DockerAvailability> {
    const result: ShellResult = await ProcessRunner.run(this.binary(), ['version', '--format', '{{.Server.Version}}'], homedir())
    if (result.code === 0) return 'ok'
    return /ENOENT|not found|is not recognized/i.test(result.stderr) ? 'missing' : 'down'
  }

  /**
   * Opens OrbStack or Docker Desktop (`open -a` on macOS, the first installed), or Docker Desktop on Windows.
   *
   * @returns `true` when one was opened; `false` on Linux or when none is installed.
   */
  public async launchDesktop(): Promise<boolean> {
    if (process.platform === 'darwin') {
      for (const [path, name] of MAC_APPS) {
        if (await DockerContainerRuntime.exists(path)) return (await ProcessRunner.run('open', ['-a', name], homedir())).code === 0
      }
      return false
    }
    if (process.platform === 'win32' && (await DockerContainerRuntime.exists(WINDOWS_DESKTOP))) {
      return (await ProcessRunner.shell(`start "" "${WINDOWS_DESKTOP}"`, homedir())).code === 0
    }
    return false
  }

  /**
   * Lists the containers with a label, running or not (`docker ps -a --filter label=…`).
   *
   * @param label - The label filter, `key` or `key=value`.
   * @returns The containers with their state and published host ports.
   */
  public async containers(label: string): Promise<ServerContainer[]> {
    return (await this.lines(['ps', '-a', '--filter', `label=${label}`, '--format', PS_FORMAT]))
      .map((line: string) => DockerContainerRuntime.container(JSON.parse(line) as PsRow))
  }

  /**
   * Lists the volumes with a label (`docker volume ls -q --filter label=…`).
   *
   * @param label - The label filter, `key` or `key=value`.
   * @returns The volume names.
   */
  public async volumes(label: string): Promise<string[]> {
    return this.lines(['volume', 'ls', '-q', '--filter', `label=${label}`])
  }

  /**
   * Lists the networks with a label (`docker network ls --filter label=…`).
   *
   * @param label - The label filter, `key` or `key=value`.
   * @returns The network names.
   */
  public async networks(label: string): Promise<string[]> {
    return this.lines(['network', 'ls', '--format', '{{.Name}}', '--filter', `label=${label}`])
  }

  /**
   * Lists the tagged local images matching a reference (`docker images reference`).
   *
   * @param reference - The image reference or pattern.
   * @returns The images as `repository:tag`, untagged ones left out.
   */
  public async images(reference: string): Promise<string[]> {
    return (await this.lines(['images', '--format', '{{.Repository}}:{{.Tag}}', reference])).filter((image: string) => !image.endsWith(':<none>'))
  }

  /**
   * Finds the host folder mounted into a container at a path (`docker inspect` on its mounts).
   *
   * @param container - The container name or id.
   * @param destination - The mount point inside the container.
   * @returns The host path, or `null` when nothing is mounted there.
   */
  public async mountSource(container: string, destination: string): Promise<string | null> {
    const format = `{{range .Mounts}}{{if eq .Destination ${JSON.stringify(destination)}}}{{.Source}}{{end}}{{end}}`
    const source: string = (await this.docker(['inspect', '-f', format, container])).trim()
    return source || null
  }

  /**
   * Lists the named volumes a container mounts (`docker inspect` on its mounts of type `volume`).
   *
   * @param container - The container name or id.
   * @returns The volume names; empty when there are none or docker fails.
   */
  public async namedVolumes(container: string): Promise<string[]> {
    const format = '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}} {{end}}{{end}}'
    const result: ShellResult = await ProcessRunner.run(this.binary(), ['inspect', '-f', format, container], homedir())
    return result.code === 0 ? result.stdout.split(/\s+/).filter(Boolean) : []
  }

  /**
   * Starts containers one by one (`docker start`); a name that fails is skipped silently.
   *
   * @param names - The container names or ids; empty does nothing.
   */
  public async start(names: readonly string[]): Promise<void> {
    for (const name of names) await ProcessRunner.run(this.binary(), ['start', name], homedir())
  }

  /**
   * Stops containers one by one (`docker stop`); a name that fails is skipped silently.
   *
   * @param names - The container names or ids; empty does nothing.
   */
  public async stop(names: readonly string[]): Promise<void> {
    for (const name of names) await ProcessRunner.run(this.binary(), ['stop', name], homedir())
  }

  /**
   * Restarts containers one by one (`docker restart`); a name that fails is skipped silently.
   *
   * @param names - The container names or ids; empty does nothing.
   */
  public async restart(names: readonly string[]): Promise<void> {
    for (const name of names) await ProcessRunner.run(this.binary(), ['restart', name], homedir())
  }

  /**
   * Removes Docker objects one by one (`docker rm -f`, `docker volume rm -f`, `docker network rm`,
   * `docker image rm`); a name that fails is skipped silently.
   *
   * @param kind - What the names are.
   * @param names - The names to remove; empty does nothing.
   */
  public async remove(kind: DockerObject, names: readonly string[]): Promise<void> {
    if (names.length === 0) return
    const args: Record<DockerObject, string[]> = { container: ['rm', '-f'], volume: ['volume', 'rm', '-f'], network: ['network', 'rm'], image: ['image', 'rm'] }
    for (const name of names) await ProcessRunner.run(this.binary(), [...args[kind], name], homedir())
  }

  /**
   * Empties a host folder with `rm -rf` in a throwaway container that mounts it (so files
   * owned by the container's user go too), then deletes the folder itself; without an image only the latter.
   *
   * @param hostPath - The folder on the host.
   * @param image - An image with `sh` to run the deletion in, or `null`.
   * @throws `Error` when the container cannot run.
   */
  public async wipeFolder(hostPath: string, image: string | null): Promise<void> {
    if (image) await this.docker(['run', '--rm', '-v', `${hostPath}:/wipe`, '--entrypoint', 'sh', image, '-c', 'rm -rf /wipe/* /wipe/.[!.]* /wipe/..?*'])
    await rm(hostPath, { recursive: true, force: true })
  }

  private async lines(args: readonly string[]): Promise<string[]> {
    return (await this.docker(args)).split('\n').map((line: string) => line.trim()).filter(Boolean)
  }

  private async docker(args: readonly string[]): Promise<string> {
    const result: ShellResult = await ProcessRunner.run(this.binary(), args, homedir())
    if (result.code !== 0) throw new Error(`docker ${args[0] ?? ''}: ${result.stderr.trim() || `exit ${String(result.code)}`}`)
    return result.stdout
  }

  private static async exists(path: string): Promise<boolean> {
    return access(path).then(() => true, () => false)
  }

  private static container(row: PsRow): ServerContainer {
    const ports: number[] = [...row.ports.matchAll(/:(\d+)->/g)].map((match: RegExpMatchArray) => Number(match[1]))
    return { id: row.id, name: row.name, image: row.image, state: row.state, status: row.status, hostPorts: [...new Set(ports)], folder: row.folder || null }
  }
}
