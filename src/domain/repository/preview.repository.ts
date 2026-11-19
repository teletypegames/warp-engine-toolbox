/**
 * Port to the loopback HTTP server Play uses.
 *
 * @module
 */
/** Port to the loopback HTTP server that serves a local build to the Play panel, with proxied host paths and generated pages. */
export interface PreviewRepository {
  /**
   * Serves a folder, starting the server on a free loopback port when it is not running yet.
   *
   * @param root - The folder to serve; replaces the earlier one.
   * @returns The base URL of the server, ending in `/`.
   */
  serve(root: string): Promise<string>
  /**
   * Forwards the requests below a path prefix to another server, caching the answers.
   *
   * @param prefix - The path prefix, e.g. `/assets/`.
   * @param upstream - The base URL to forward to.
   */
  proxy(prefix: string, upstream: string): void
  /**
   * Serves fixed HTML at a path, ahead of the files.
   *
   * @param path - The path, e.g. `/index.html`.
   * @param html - The page.
   */
  page(path: string, html: string): void
  /** Stops the server; does nothing when it is not running. */
  close(): Promise<void>
}
