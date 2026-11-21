/**
 * Why the current host does not answer, as {@link domain/service/repair.service!RepairService} finds it.
 *
 * @module
 */

/** The state of the current host and, when it is the local engine, of the engine on this machine; each kind has the steps that put it right. */
export type HostDiagnosis =
  | {
      /** The host answers: nothing to repair. */
      readonly kind: 'answers'
      /** The address that answers. */
      readonly url: string
    }
  | {
      /** No host is set. */
      readonly kind: 'noHost'
    }
  | {
      /** A host on another machine does not answer. */
      readonly kind: 'remote'
      /** Its address. */
      readonly url: string
    }
  | {
      /** The local engine does not answer from a dev container, where Docker cannot be asked. */
      readonly kind: 'inside'
      /** The address set. */
      readonly url: string
    }
  | {
      /** There is no Docker command. */
      readonly kind: 'dockerMissing'
    }
  | {
      /** Docker does not answer. */
      readonly kind: 'dockerDown'
    }
  | {
      /** There is no engine container. */
      readonly kind: 'notInstalled'
      /** The data a reinstall keeps and a purge removes, or `null` when there is none. */
      readonly dataFolder: string | null
      /** Whether the installer saved its answers, so a reinstall asks nothing. */
      readonly configured: boolean
    }
  | {
      /** Some WarpEngine containers do not run. */
      readonly kind: 'stopped'
      /** Their names. */
      readonly containers: readonly string[]
    }
  | {
      /** The local engine answers at another address than the host set. */
      readonly kind: 'elsewhere'
      /** The address it answers at. */
      readonly url: string
    }
  | {
      /** The engine container runs but does not answer. */
      readonly kind: 'notAnswering'
      /** The address set. */
      readonly url: string
    }
