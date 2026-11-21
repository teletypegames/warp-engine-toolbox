/**
 * The names a dev container of a WarpEngine project is known by.
 *
 * @module
 */

/** Where a project keeps its dev container and how a process knows it runs in one. */
export class DevContainer {
  /** The dev container definition, relative to the project folder. */
  public static readonly FILE: string = '.devcontainer/devcontainer.json'
  /** The environment variable the template's `devcontainer.json` sets to `1` inside the container. */
  public static readonly ENV: string = 'WARPENGINE_DEVCONTAINER'
}
