/**
 * Port to the WarpEngine Local installation on this machine.
 *
 * @module
 */
/** Port to the WarpEngine Local installation on this machine: its port and its admin token. Members resolve to `null` instead of rejecting. */
export interface LocalEngineRepository {
  /**
   * Finds the port the local engine listens on: the `localPort` setting, else the installation's `config.json`.
   *
   * @returns The port, or `null` when neither names one.
   */
  port(): Promise<number | null>
  /**
   * Reads the admin token the installation left in its data folder.
   *
   * @returns The token, or `null` when the file is missing or empty.
   */
  tokenFile(): Promise<string | null>
  /**
   * Asks the running local engine container for its admin token.
   *
   * @returns The token, or `null` when the container is not running or gives none.
   */
  tokenFromContainer(): Promise<string | null>
}
