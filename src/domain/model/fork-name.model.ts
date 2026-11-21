/**
 * The name a fork gets on its host: `<name>-<user>`, numbered while it is taken.
 *
 * @module
 */
const NAME_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FALLBACK_USER = 'fork'

/** Rules on the technical name of a fork. */
export class ForkNames {
  /**
   * Whether a name is one a host takes: lower-case letters, digits and single dashes between them.
   *
   * @param name - The name.
   * @returns `true` when the name is well formed.
   */
  public static isValid(name: string): boolean {
    return NAME_FORMAT.test(name)
  }

  /**
   * The user part of a fork name from a principal's label: the part of an e-mail address before the `@`, lower-cased,
   * every run of other characters turned into one dash.
   *
   * @param label - The signed-in principal's label, or `null`.
   * @returns The slug; `fork` when nothing usable is left.
   */
  public static userSlug(label: string | null): string {
    const local: string = (label ?? '').split('@')[0] ?? ''
    const slug: string = local.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return slug || FALLBACK_USER
  }

  /**
   * The first name offered for a fork: `<name>-<user>`.
   *
   * @param name - The original software's name.
   * @param label - The label of the user signed in on the target host, or `null`.
   * @returns The base name.
   */
  public static base(name: string, label: string | null): string {
    return `${name}-${ForkNames.userSlug(label)}`
  }

  /**
   * The n-th candidate for a fork name: the base itself, then `-2`, `-3`, ….
   *
   * @param base - The base name.
   * @param index - The candidate's number, from 1.
   * @returns The candidate.
   */
  public static numbered(base: string, index: number): string {
    return index <= 1 ? base : `${base}-${String(index)}`
  }
}
