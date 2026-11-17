export interface PreviewRepository {
  serve(root: string): Promise<string>
  proxy(prefix: string, upstream: string): void
  page(path: string, html: string): void
  close(): Promise<void>
}
