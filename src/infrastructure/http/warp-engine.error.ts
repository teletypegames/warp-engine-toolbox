/**
 * The error a failed WarpEngine HTTP request throws.
 *
 * @module
 */
import { HostError } from '../../domain/model/host-error.model'

/**
 * A {@link domain/model/host-error.model!HostError} raised by the HTTP client: the host's own error text when it
 * sent one, the HTTP status otherwise.
 */
export class WarpEngineError extends HostError {
  /**
   * Creates the error.
   *
   * @param message - The text to show.
   * @param status - The HTTP status; `0` when the host could not be reached.
   */
  public constructor(message: string, status: number) {
    super(message, status)
    this.name = 'WarpEngineError'
  }

  /**
   * Builds the error from a failed response, reading its body.
   *
   * The message is the `error` string, or `error.message`, of a JSON body; otherwise
   * the status code and status text.
   *
   * @param response - The non-2xx response; its body is consumed.
   * @returns The error carrying the response status.
   */
  public static async from(response: Response): Promise<WarpEngineError> {
    return new WarpEngineError(await WarpEngineError.message(response), response.status)
  }

  private static async message(response: Response): Promise<string> {
    const text: string = await response.text().catch(() => '')
    return WarpEngineError.parse(text) ?? `${String(response.status)} ${response.statusText}`.trim()
  }

  private static parse(text: string): string | null {
    try {
      const error: unknown = (JSON.parse(text) as { error?: unknown }).error
      if (typeof error === 'string') return error
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
      return null
    } catch {
      return null
    }
  }
}
