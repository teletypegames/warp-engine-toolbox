import type { Commit } from '../model/commit.model'
import type { GitRemote } from '../model/git-remote.model'

export interface SourceControl {
  isRepository(): Promise<boolean>
  head(): Promise<string | null>
  branch(): Promise<string | null>
  defaultBranch(): Promise<string | null>
  isClean(): Promise<boolean>
  remote(): Promise<string | null>
  remoteUrl(name: string): Promise<string | null>
  remotes(): Promise<GitRemote[]>
  setRemoteUrl(name: string, url: string): Promise<void>
  hasCommits(): Promise<boolean>
  fetchTags(): Promise<void>
  lastTag(): Promise<string | null>
  commitsSince(ref: string | null): Promise<Commit[]>
  init(branch: string): Promise<void>
  addAll(): Promise<void>
  commit(message: string): Promise<void>
  setRemote(url: string): Promise<void>
  tag(name: string, message: string): Promise<void>
  push(args: readonly string[]): Promise<void>
}

export interface SourceControlFactory {
  at(folder: string): SourceControl
  userName(): Promise<string>
}
