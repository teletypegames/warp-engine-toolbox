export interface TemplateTree {
  readonly files: readonly string[]
  read(path: string): Promise<Uint8Array>
  dispose(): Promise<void>
}

export interface TemplateRepository {
  download(repositoryUrl: string, ref: string): Promise<TemplateTree>
}
