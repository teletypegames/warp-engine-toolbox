export interface GameAnswers {
  readonly name: string
  readonly title: string
  readonly author: string
  readonly license: string
  readonly category: string | null
  readonly description: string
  readonly version: string
}

export const LICENSES: readonly string[] = ['MIT', 'GPL-3.0-or-later', 'Apache-2.0', 'CC-BY-4.0', 'CC-BY-NC-4.0', 'Proprietary']
export const FIRST_VERSION = '0.1.0'

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/

export class GameName {
  public static isValid(name: string): boolean {
    return NAME_PATTERN.test(name)
  }

  public static suggest(text: string | null): string {
    return (text ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  }

  public static titleize(name: string): string {
    return name.split('-').filter(Boolean).map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
}
