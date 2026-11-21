/**
 * Why a git command that talks to a remote failed, read from git's error text.
 *
 * @module
 */
import { msg, type Message } from './message.model'

/** The kind of a failed clone or fetch: the remote refused the credentials, could not be reached, has no such repository, or something else. */
export type GitFailureKind = 'auth' | 'unreachable' | 'missing' | 'other'

const PATTERNS: readonly (readonly [GitFailureKind, RegExp])[] = [
  ['auth', /authentication failed|could not read (?:username|password)|permission denied \(publickey|terminal prompts disabled|host key verification failed|\b40[13]\b/i],
  ['missing', /repository not found|does not appear to be a git repository|not found|\b404\b/i],
  ['unreachable', /could not resolve host|connection refused|timed out|network is unreachable|failed to connect|unable to access|no route to host/i]
]

const MESSAGES: Readonly<Record<GitFailureKind, (url: string, text: string) => Message>> = {
  auth: (url: string) => msg('git could not sign in to {0}: the repository may be private. Add your SSH key or a git credential for it, then try again.', url),
  unreachable: (url: string) => msg('{0} cannot be reached: check the network and the address, then try again.', url),
  missing: (url: string) => msg('{0} was not found: it may be private or moved. Ask its author, then try again.', url),
  other: (url: string, text: string) => msg('git could not reach {0}: {1}', url, text)
}

/** Rules on the error text of a failed git command. */
export class GitFailures {
  /**
   * Classifies a git error text.
   *
   * @param text - git's standard error, or the message of the error thrown.
   * @returns The first kind whose pattern matches; `other` when none does.
   */
  public static kind(text: string): GitFailureKind {
    return PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other'
  }

  /**
   * The message for a failed clone or fetch: what went wrong and what to do about it.
   *
   * @param url - The remote's address, safe to show.
   * @param error - What git threw.
   * @returns The message for the failure's kind.
   */
  public static message(url: string, error: unknown): Message {
    const text: string = GitFailures.textOf(error)
    return MESSAGES[GitFailures.kind(text)](url, text)
  }

  /**
   * The text of anything a git command threw.
   *
   * @param error - What was thrown.
   * @returns Its message, or the value as a string.
   */
  public static textOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
