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
}
