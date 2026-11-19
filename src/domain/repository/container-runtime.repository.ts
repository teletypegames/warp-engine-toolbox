import type { ServerContainer } from '../model/server.model'

export type DockerObject = 'container' | 'volume' | 'network' | 'image'

export interface ContainerRuntime {
  containers(label: string): Promise<ServerContainer[]>
  volumes(label: string): Promise<string[]>
  networks(label: string): Promise<string[]>
  images(reference: string): Promise<string[]>
  mountSource(container: string, destination: string): Promise<string | null>
  remove(kind: DockerObject, names: readonly string[]): Promise<void>
  wipeFolder(hostPath: string, image: string): Promise<void>
}
