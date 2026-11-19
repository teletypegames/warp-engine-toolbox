/**
 * Watches the built-in git extension for new commits and pushes.
 *
 * @module
 */
import * as vscode from 'vscode'

interface GitExtension { getAPI(version: 1): GitApi }
interface GitApi { readonly repositories: GitRepository[]; readonly onDidOpenRepository: vscode.Event<GitRepository> }
interface GitHead { readonly commit?: string; readonly ahead?: number }
// eslint-disable-next-line @typescript-eslint/naming-convention -- the git extension's own field name
interface GitRepository { readonly state: { readonly HEAD: GitHead | undefined; readonly onDidChange: vscode.Event<void> } }

/**
 * Calls back when `HEAD` of any repository the built-in git extension opens moves to
 * another commit, or when its unpushed commits drop to zero (a push). Does nothing when
 * the git extension is missing.
 */
export class GitWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = []

  /**
   * Starts watching, activating the git extension when it is not active yet.
   *
   * @param onChange - Called on every commit or push.
   */
  public constructor(private readonly onChange: () => void) {
    const git: vscode.Extension<GitExtension> | undefined = vscode.extensions.getExtension<GitExtension>('vscode.git')
    if (!git) return
    void Promise.resolve(git.isActive ? git.exports : git.activate())
      .then((exports: GitExtension) => { this.hook(exports.getAPI(1)) })
      .catch(() => undefined)
  }

  /** Stops watching the repositories. */
  public dispose(): void {
    for (const disposable of this.disposables) disposable.dispose()
  }

  private hook(api: GitApi): void {
    api.repositories.forEach((repository: GitRepository) => { this.attach(repository) })
    this.disposables.push(api.onDidOpenRepository((repository: GitRepository) => { this.attach(repository) }))
  }

  private attach(repository: GitRepository): void {
    let head: GitHead = GitWatcher.snapshot(repository)
    this.disposables.push(repository.state.onDidChange(() => {
      const next: GitHead = GitWatcher.snapshot(repository)
      if (GitWatcher.moved(head, next)) this.onChange()
      head = next
    }))
  }

  private static snapshot(repository: GitRepository): GitHead {
    const head: GitHead | undefined = repository.state.HEAD
    return { commit: head?.commit, ahead: head?.ahead }
  }

  private static moved(before: GitHead, after: GitHead): boolean {
    const pushed: boolean = before.ahead !== undefined && before.ahead > 0 && after.ahead === 0
    return after.commit !== before.commit || pushed
  }
}
