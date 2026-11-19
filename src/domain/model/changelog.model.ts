/**
 * The `CHANGELOG.md` entries written when a release is cut.
 *
 * @module
 */
import type { Commit } from './commit.model'

const SKIPPED = /^(Merge |Bump version|Release v?\d)/
const TITLE = '# Changelog\n\n'

/** Builds the Markdown `CHANGELOG.md` entries written when a release is cut. */
export class Changelog {
  /**
   * The Markdown section of one version: a `## version — date` heading and one
   * bullet per commit (subject and short sha). Merge, version-bump and release
   * commits are left out; with none left, the section says no changes were recorded.
   *
   * @param version - The version being released.
   * @param commits - The commits since the previous release.
   * @param date - The release date, as it should appear in the heading.
   * @returns The section, ending with a newline.
   */
  public static entry(version: string, commits: readonly Commit[], date: string): string {
    const lines: string[] = commits
      .filter((commit: Commit) => !SKIPPED.test(commit.subject))
      .map((commit: Commit) => `- ${commit.subject} (${commit.sha.slice(0, 7)})`)
    return [`## ${version} — ${date}`, '', ...(lines.length > 0 ? lines : ['- No changes recorded']), ''].join('\n')
  }

  /**
   * Puts an entry at the top of a changelog, under the `# Changelog` title.
   *
   * @param existing - The current file content, or `null` when there is no file yet.
   * @param entry - The section made by {@link Changelog.entry}.
   * @returns The whole new file content.
   */
  public static prepend(existing: string | null, entry: string): string {
    if (!existing) return `${TITLE}${entry}`
    const body: string = existing.startsWith('# Changelog') ? existing.replace(/^# Changelog\s*\n+/, '') : existing
    return `${TITLE}${entry}\n${body}`
  }
}
