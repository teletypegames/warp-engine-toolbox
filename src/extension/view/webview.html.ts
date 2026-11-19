/**
 * Helpers for the HTML of the webviews.
 *
 * @packageDocumentation
 */

import { randomBytes } from 'node:crypto'

const NONCE_BYTES = 16

/** Helpers for the HTML of the webviews. */
export class WebviewHtml {
  /**
   * A random nonce for the scripts of a page.
   *
   * @returns The nonce, in base64.
   */
  public static nonce(): string {
    return randomBytes(NONCE_BYTES).toString('base64')
  }

  /**
   * Escapes a text for HTML content and attribute values.
   *
   * @param text - The text.
   * @returns The escaped text.
   */
  public static escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  /**
   * Serializes a value as JSON that is safe inside a `<script>` element.
   *
   * @param value - The value.
   * @returns The JSON text, with `<` escaped.
   */
  public static json(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c')
  }
}
