/**
 * The confirmation of a destructive action by typing a name: the action runs only when the typed text is exactly that name.
 *
 * @module
 */

/** A name the user has to type to confirm an action, such as the slug of a software before it is deleted from the catalog. */
export class TypedConfirmation {
  /**
   * Creates the confirmation.
   *
   * @param expected - The text that confirms, e.g. the software's `name`.
   */
  public constructor(public readonly expected: string) {}

  /**
   * Whether the typed text confirms: the same as {@link TypedConfirmation.expected}, letter case included, after the surrounding spaces are cut.
   *
   * @param input - The text typed, or `undefined` when nothing was typed.
   * @returns `true` only for an exact match; an empty expected name never matches.
   */
  public matches(input: string | undefined): boolean {
    return this.expected.length > 0 && (input ?? '').trim() === this.expected
  }
}
