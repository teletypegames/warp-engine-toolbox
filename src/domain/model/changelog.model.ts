import type { Commit } from './commit.model'

const SKIPPED = /^(Merge |Bump version|Release v?\d)/
const TITLE = '# Changelog\n\n'

export class Changelog {
  public static entry(version: string, commits: readonly Commit[], date: string): string {
    const lines: string[] = commits
      .filter((commit: Commit) => !SKIPPED.test(commit.subject))
      .map((commit: Commit) => `- ${commit.subject} (${commit.sha.slice(0, 7)})`)
    return [`## ${version} — ${date}`, '', ...(lines.length > 0 ? lines : ['- No changes recorded']), ''].join('\n')
  }

  public static prepend(existing: string | null, entry: string): string {
    if (!existing) return `${TITLE}${entry}`
    const body: string = existing.startsWith('# Changelog') ? existing.replace(/^# Changelog\s*\n+/, '') : existing
    return `${TITLE}${entry}\n${body}`
  }
}
