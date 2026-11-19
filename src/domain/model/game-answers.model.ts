/**
 * The New Game answers and the rules on a game's technical name.
 *
 * @module
 */
/** The answers to the New Game questions, from which a project is scaffolded. */
export interface GameAnswers {
  /** The technical name: a lowercase slug (see {@link GameName.isValid}). */
  readonly name: string
  /** The human-readable title. */
  readonly title: string
  /** The author. */
  readonly author: string
  /** The licence, usually one of {@link LICENSES}. */
  readonly license: string
  /** The category key, or `null` for none. */
  readonly category: string | null
  /** The description. */
  readonly description: string
  /** The project's first version, {@link FIRST_VERSION}. */
  readonly version: string
}

/** The licences offered when creating a game. */
export const LICENSES: readonly string[] = ['MIT', 'GPL-3.0-or-later', 'Apache-2.0', 'CC-BY-4.0', 'CC-BY-NC-4.0', 'Proprietary']
/** The version a new game starts at. */
export const FIRST_VERSION = '0.1.0'

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/

/** Rules on a game's technical name. */
export class GameName {
  /**
   * Whether a name is a valid slug: lowercase letters, digits and dashes, starting
   * with a letter or digit, at most 63 characters.
   *
   * @param name - The name to check.
   * @returns `true` when valid.
   */
  public static isValid(name: string): boolean {
    return NAME_PATTERN.test(name)
  }

  /**
   * A slug suggested from free text: lowercased, other characters turned into
   * dashes, leading and trailing dashes removed.
   *
   * @param text - The text to derive it from (e.g. a folder name), or `null`.
   * @returns The suggestion; empty when nothing usable is left.
   */
  public static suggest(text: string | null): string {
    return (text ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  }

  /**
   * A title made from a slug: the dash-separated words capitalised and joined by spaces.
   *
   * @param name - The slug.
   * @returns The title, e.g. `My Game` for `my-game`.
   */
  public static titleize(name: string): string {
    return name.split('-').filter(Boolean).map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
}
