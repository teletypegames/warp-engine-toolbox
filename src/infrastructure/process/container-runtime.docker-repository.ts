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

export class DockerContainerRuntime implements ContainerRuntime {
  public constructor(private readonly binary: () => string) {}

  public async containers(label: string): Promise<ServerContainer[]> {
    return (await this.lines(['ps', '-a', '--filter', `label=${label}`, '--format', PS_FORMAT]))
      .map((line: string) => DockerContainerRuntime.container(JSON.parse(line) as PsRow))
  }

  public async volumes(label: string): Promise<string[]> {
    return this.lines(['volume', 'ls', '-q', '--filter', `label=${label}`])
  }

  public async networks(label: string): Promise<string[]> {
    return this.lines(['network', 'ls', '--format', '{{.Name}}', '--filter', `label=${label}`])
  }

  public async images(reference: string): Promise<string[]> {
    return (await this.lines(['images', '--format', '{{.Repository}}:{{.Tag}}', reference])).filter((image: string) => !image.endsWith(':<none>'))
  }

  public async mountSource(container: string, destination: string): Promise<string | null> {
    const format = `{{range .Mounts}}{{if eq .Destination ${JSON.stringify(destination)}}}{{.Source}}{{end}}{{end}}`
    const source: string = (await this.docker(['inspect', '-f', format, container])).trim()
    return source || null
  }

  public async remove(kind: DockerObject, names: readonly string[]): Promise<void> {
    if (names.length === 0) return
    const args: Record<DockerObject, string[]> = { container: ['rm', '-f'], volume: ['volume', 'rm', '-f'], network: ['network', 'rm'], image: ['image', 'rm'] }
    for (const name of names) await ProcessRunner.run(this.binary(), [...args[kind], name], homedir())
  }

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
