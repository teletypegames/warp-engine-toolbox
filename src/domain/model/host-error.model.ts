/**
 * The error of a failed request to a WarpEngine host.
 *
 * @module
 */
/** A failed request to a WarpEngine host, carrying the HTTP status it answered. */
export class HostError extends Error {
  /** The HTTP status of a missing or rejected token. */
  public static readonly UNAUTHORIZED: number = 401

  /**
   * Creates the error.
   *
   * @param message - What went wrong, as shown to the user.
   * @param status - The HTTP status the host answered.
   */
  public constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'HostError'
  }

  /**
   * Whether an error is a {@link HostError} with status 401, i.e. the user has to sign in again.
   *
   * @param error - Any caught value.
   * @returns `true` for an unauthorized host error.
   */
  public static isUnauthorized(error: unknown): boolean {
    return error instanceof HostError && error.status === HostError.UNAUTHORIZED
  }
}
