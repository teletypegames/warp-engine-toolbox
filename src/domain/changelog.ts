export interface Commit {
  readonly sha: string
  readonly subject: string
}

const SKIPPED = /^(Merge |Bump version|Release v?\d)/

export function changelog(version: string, commits: readonly Commit[], date: string): string {
  const lines: string[] = commits
    .filter((commit: Commit) => !SKIPPED.test(commit.subject))
    .map((commit: Commit) => `- ${commit.subject} (${commit.sha.slice(0, 7)})`)
  return [`## ${version} — ${date}`, '', ...(lines.length > 0 ? lines : ['- No changes recorded']), ''].join('\n')
}

export function prependChangelog(existing: string | null, entry: string): string {
  const title = '# Changelog\n\n'
  if (!existing) return `${title}${entry}`
  const body: string = existing.startsWith('# Changelog') ? existing.replace(/^# Changelog\s*\n+/, '') : existing
  return `${title}${entry}\n${body}`
}
