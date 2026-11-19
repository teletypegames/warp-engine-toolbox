import { HostError } from '../../domain/model/host-error.model'

export class WarpEngineError extends HostError {
  public constructor(message: string, status: number) {
    super(message, status)
    this.name = 'WarpEngineError'
  }

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
