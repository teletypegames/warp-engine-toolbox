/**
 * The {@link domain/repository/container-runtime.repository!ContainerRuntime} port implemented with the `docker` command line.
 *
 * @module
 */
import { rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import type { ServerContainer } from '../../domain/model/server.model'
import type { ContainerRuntime, DockerObject } from '../../domain/repository/container-runtime.repository'
import type { ShellResult } from '../../domain/repository/shell.repository'
import { ProcessRunner } from './process.runner'

interface PsRow {
  readonly id: string
  readonly name: string
  readonly image: string
  readonly state: string
  readonly status: string
  readonly ports: string
}

const PS_FORMAT = '{"id":{{json .ID}},"name":{{json .Names}},"image":{{json .Image}},"state":{{json .State}},"status":{{json .Status}},"ports":{{json .Ports}}}'

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
   * owned by the container's user go too), then deletes the folder itself.
   *
   * @param hostPath - The folder on the host.
   * @param image - An image with `sh` to run the deletion in.
   * @throws `Error` when the container cannot run.
   */
  public async wipeFolder(hostPath: string, image: string): Promise<void> {
    await this.docker(['run', '--rm', '-v', `${hostPath}:/wipe`, '--entrypoint', 'sh', image, '-c', 'rm -rf /wipe/* /wipe/.[!.]* /wipe/..?*'])
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

  private static container(row: PsRow): ServerContainer {
    const ports: number[] = [...row.ports.matchAll(/:(\d+)->/g)].map((match: RegExpMatchArray) => Number(match[1]))
    return { id: row.id, name: row.name, image: row.image, state: row.state, status: row.status, hostPorts: [...new Set(ports)] }
  }
}
