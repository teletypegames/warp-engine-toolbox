export type ServerRole = 'engine' | 'git' | 'ci' | 'agent' | 'other'

export interface ServerContainer {
  readonly id: string
  readonly name: string
  readonly image: string
  readonly state: string
  readonly status: string
  readonly hostPorts: readonly number[]
}

export interface PurgePlan {
  readonly containers: readonly ServerContainer[]
  readonly volumes: readonly string[]
  readonly networks: readonly string[]
  readonly images: readonly string[]
  readonly dataFolder: string | null
}

export class Servers {
  public static readonly LABEL: string = 'org.teletypegames.warp-engine.local=1'
  public static readonly ENGINE: string = 'warp-engine-local'
  public static readonly ENGINE_IMAGE: string = 'git.teletypegames.org/build/warp-engine-local'
  public static readonly DATA_MOUNT: string = '/data'

  public static role(container: ServerContainer): ServerRole {
    if (container.name === Servers.ENGINE) return 'engine'
    if (container.name.endsWith('-gitea')) return 'git'
    if (container.name.endsWith('-woodpecker-agent')) return 'agent'
    return container.name.endsWith('-woodpecker') ? 'ci' : 'other'
  }

  public static url(container: ServerContainer): string | null {
    const port: number | undefined = container.hostPorts[0]
    if (port === undefined || container.state !== 'running') return null
    return Servers.role(container) === 'engine' ? `http://127.0.0.1:${String(port)}` : `http://localhost:${String(port)}`
  }

  public static sorted(containers: readonly ServerContainer[]): ServerContainer[] {
    const order: readonly ServerRole[] = ['engine', 'git', 'ci', 'agent', 'other']
    return [...containers].sort((a: ServerContainer, b: ServerContainer) => order.indexOf(Servers.role(a)) - order.indexOf(Servers.role(b)))
  }

  public static wipeable(folder: string | null): string | null {
    if (!folder) return null
    return folder.split(/[\\/]/).filter(Boolean).length >= 2 ? folder : null
  }

  public static isEmpty(plan: PurgePlan): boolean {
    return plan.containers.length + plan.volumes.length + plan.networks.length + plan.images.length === 0 && plan.dataFolder === null
  }
}
