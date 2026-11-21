/**
 * Port to the WarpEngine Local installation on this machine.
 *
 * @module
 */
/** Port to the WarpEngine Local installation on this machine: its port, its admin token and its data folder. Members resolve to `null` (or `false`) instead of rejecting. */
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
  /**
   * Finds the installation's data folder (the `localData` setting, else `~/.warpengine`) when it exists.
   *
   * @returns The folder, or `null` when there is none.
   */
  dataFolder(): Promise<string | null>
  /**
   * Tells whether the installer saved its answers (`config.json` in the data folder), so it can run again without asking.
   *
   * @returns `true` when the answers are saved.
   */
  configured(): Promise<boolean>
}
