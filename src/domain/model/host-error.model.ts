export class HostError extends Error {
  public static readonly UNAUTHORIZED: number = 401

  public constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'HostError'
  }

  public static isUnauthorized(error: unknown): boolean {
    return error instanceof HostError && error.status === HostError.UNAUTHORIZED
  }
}
