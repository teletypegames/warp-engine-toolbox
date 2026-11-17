import { createReadStream, type Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, normalize, resolve, sep } from 'node:path'
import type { PreviewRepository } from '../../domain/repository/preview.repository'
import { BINARY, contentType } from './content-types'

interface Cached {
  readonly type: string
  readonly body: Buffer
}

const LOOPBACK = '127.0.0.1'
const UPSTREAM_TIMEOUT_MS = 120_000
const HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cache-Control': 'no-store'
}

export class PreviewServer implements PreviewRepository {
  private server: Server | null = null
  private root = ''
  private readonly pages: Map<string, string> = new Map<string, string>()
  private readonly proxies: Map<string, string> = new Map<string, string>()
  private readonly cache: Map<string, Cached> = new Map<string, Cached>()

  public async serve(root: string): Promise<string> {
    this.root = resolve(root)
    this.server ??= await this.listen()
    return `http://${LOOPBACK}:${String((this.server.address() as AddressInfo).port)}/`
  }

  public proxy(prefix: string, upstream: string): void {
    this.proxies.set(prefix, upstream.replace(/\/+$/, ''))
  }

  public page(path: string, html: string): void {
    this.pages.set(path, html)
  }

  public async close(): Promise<void> {
    const server: Server | null = this.server
    this.server = null
    if (server) await new Promise<void>((done: () => void) => { server.close(() => { done() }) })
  }

  private async listen(): Promise<Server> {
    const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => { void this.handle(request, response) })
    await new Promise<void>((done: () => void) => { server.listen(0, LOOPBACK, done) })
    return server
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    for (const [name, value] of Object.entries(HEADERS)) response.setHeader(name, value)
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
    await this.route(request, response)
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path: string = decodeURIComponent(new URL(request.url ?? '/', `http://${LOOPBACK}`).pathname)
    const prefix: string | undefined = [...this.proxies.keys()].find((candidate: string) => path.startsWith(candidate))
    if (prefix !== undefined) await this.forward(`${this.proxies.get(prefix) ?? ''}${request.url ?? path}`, response)
    else if (this.pages.has(path)) this.sendPage(this.pages.get(path) ?? '', response)
    else await this.sendFile(path, response)
  }

  private sendPage(html: string, response: ServerResponse): void {
    response.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
  }

  private async sendFile(path: string, response: ServerResponse): Promise<void> {
    const file: string = normalize(join(this.root, path))
    if (file !== this.root && !file.startsWith(this.root + sep)) { response.writeHead(403).end(); return }
    try {
      const found: { file: string; info: Stats } = await PreviewServer.locate(file)
      response.writeHead(200, { 'Content-Type': contentType(found.file), 'Content-Length': found.info.size })
      createReadStream(found.file).pipe(response)
    } catch {
      response.writeHead(404).end()
    }
  }

  private static async locate(file: string): Promise<{ file: string; info: Stats }> {
    const info: Stats = await stat(file)
    if (!info.isDirectory()) return { file, info }
    const index: string = join(file, 'index.html')
    return { file: index, info: await stat(index) }
  }

  private async forward(url: string, response: ServerResponse): Promise<void> {
    const entry: Cached | number = this.cache.get(url) ?? await this.fetchUpstream(url)
    if (typeof entry === 'number') { response.writeHead(entry).end(); return }
    response.writeHead(200, { 'Content-Type': entry.type, 'Content-Length': entry.body.length })
    response.end(entry.body)
  }

  private async fetchUpstream(url: string): Promise<Cached | number> {
    try {
      const upstream: Response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
      if (!upstream.ok) return upstream.status
      const entry: Cached = { type: upstream.headers.get('content-type') ?? BINARY, body: Buffer.from(await upstream.arrayBuffer()) }
      this.cache.set(url, entry)
      return entry
    } catch {
      return 502
    }
  }
}
