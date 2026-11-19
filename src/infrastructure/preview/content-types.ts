/**
 * The content types the preview server sends, by file extension.
 *
 * @module
 */
import { extname } from 'node:path'

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

/** The content type of a file whose extension is not known: `application/octet-stream`. */
export const BINARY = 'application/octet-stream'

/**
 * Picks the content type of a file from its extension, ignoring case.
 *
 * @param file - The file name or path.
 * @returns The content type, or {@link BINARY} for an unknown extension.
 */
export function contentType(file: string): string {
  return TYPES[extname(file).toLowerCase()] ?? BINARY
}
