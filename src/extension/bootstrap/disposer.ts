/**
 * The shape of anything the extension disposes on deactivation.
 *
 * @packageDocumentation
 */

/** Anything with a `dispose()`: a VS Code disposable, a view, a store, a watcher. */
export interface Disposer {
  /** Releases what the object holds: listeners, registrations, timers. */
  dispose(): unknown
}
