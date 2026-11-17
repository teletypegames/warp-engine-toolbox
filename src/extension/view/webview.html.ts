import { randomBytes } from 'node:crypto'

const NONCE_BYTES = 16

export class WebviewHtml {
  public static nonce(): string {
    return randomBytes(NONCE_BYTES).toString('base64')
  }

  public static escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  public static json(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c')
  }
}
