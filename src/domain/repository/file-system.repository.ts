export interface FileQuery {
  readonly folder: string
  readonly include: string
  readonly exclude: string | null
  readonly limit: number
}

export interface FileSystemRepository {
  readText(path: string): Promise<string | null>
  writeText(path: string, text: string): Promise<void>
  readBytes(path: string): Promise<Uint8Array>
  writeBytes(path: string, bytes: Uint8Array): Promise<void>
  exists(path: string): Promise<boolean>
  find(query: FileQuery): Promise<string[]>
  modifiedAt(path: string): Promise<number>
}
