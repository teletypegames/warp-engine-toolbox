import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve, sep } from 'node:path'

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pck': 'application/octet-stream',
  '.zip': 'application/zip'
}

export class PreviewServer {
  private server: Server | null = null
  private root = ''
  private readonly pages = new Map<string, string>()
  private readonly proxies = new Map<string, string>()
  private readonly cache = new Map<string, { type: string; body: Buffer }>()

  public async serve(root: string): Promise<string> {
    this.root = resolve(root)
    if (!this.server) {
      const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => { void this.handle(request, response) })
      await new Promise<void>((done: () => void) => { server.listen(0, '127.0.0.1', done) })
      this.server = server
    }
    const address: AddressInfo = this.server.address() as AddressInfo
    return `http://127.0.0.1:${String(address.port)}/`
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

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    response.setHeader('Cache-Control', 'no-store')
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
    const path: string = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
    const prefix: string | undefined = [...this.proxies.keys()].find((candidate: string) => path.startsWith(candidate))
    if (prefix !== undefined) {
      await this.forward(`${this.proxies.get(prefix) ?? ''}${request.url ?? path}`, response)
      return
    }
    const page: string | undefined = this.pages.get(path)
    if (page !== undefined) {
      response.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page)
      return
    }
    let file: string = normalize(join(this.root, path))
    if (file !== this.root && !file.startsWith(this.root + sep)) { response.writeHead(403).end(); return }
    try {
      let info = await stat(file)
      if (info.isDirectory()) {
        file = join(file, 'index.html')
        info = await stat(file)
      }
      response.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': info.size })
      createReadStream(file).pipe(response)
    } catch {
      response.writeHead(404).end()
    }
  }

  private async forward(url: string, response: ServerResponse): Promise<void> {
    let entry: { type: string; body: Buffer } | undefined = this.cache.get(url)
    if (!entry) {
      try {
        const upstream: Response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
        if (!upstream.ok) {
          response.writeHead(upstream.status).end()
          return
        }
        entry = { type: upstream.headers.get('content-type') ?? 'application/octet-stream', body: Buffer.from(await upstream.arrayBuffer()) }
        this.cache.set(url, entry)
      } catch {
        response.writeHead(502).end()
        return
      }
    }
    response.writeHead(200, { 'Content-Type': entry.type, 'Content-Length': entry.body.length })
    response.end(entry.body)
  }
}
