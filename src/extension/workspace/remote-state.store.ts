import * as vscode from 'vscode'
import type { Release } from '../../domain/model/catalog.model'
import { isRunning } from '../../domain/model/pipeline.model'
import type { Project } from '../../domain/model/project.model'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { RemoteStateService } from '../../domain/service/remote-state.service'
import type { ProjectRegistry } from './project.registry'

const POLL_MS = 10_000
const POLL_LIMIT_MS: number = 20 * 60_000

export class RemoteStateStore implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<RemoteState | null> = new vscode.EventEmitter<RemoteState | null>()
  public readonly onDidChange: vscode.Event<RemoteState | null> = this.changed.event
  private readonly built: vscode.EventEmitter<RemoteState> = new vscode.EventEmitter<RemoteState>()
  public readonly onDidBuildBranch: vscode.Event<RemoteState> = this.built.event
  private readonly announced: Set<string> = new Set<string>()
  private state: RemoteState | null = null
  private timer: NodeJS.Timeout | undefined
  private pollingSince = 0
  private loading: Promise<void> | null = null

  public constructor(private readonly service: RemoteStateService, private readonly projects: ProjectRegistry) {}

  public current(): RemoteState | null {
    return this.state
  }

  public watch(): void {
    this.pollingSince = Date.now()
    void this.refresh()
  }

  public async refresh(): Promise<void> {
    this.loading ??= this.load().finally(() => { this.loading = null })
    return this.loading
  }

  public dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.changed.dispose()
    this.built.dispose()
  }

  private async load(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    const project: Project | null = this.projects.current()
    const state: RemoteState | null = project ? await this.service.load(project) : null
    this.publish(state)
    if (!state?.signedIn || state.error) return
    this.announce(state)
    this.schedule(state)
  }

  private announce(state: RemoteState): void {
    const build: Release | null = state.branchBuild
    if (!build) return
    const key = `${String(build.id)}@${build.updatedAt ?? build.createdAt ?? ''}`
    if (this.pollingSince > 0 && !this.announced.has(key)) this.built.fire(state)
    this.announced.add(key)
  }

  private schedule(state: RemoteState): void {
    const polling: boolean = Date.now() - this.pollingSince < POLL_LIMIT_MS
    const waiting: boolean = state.headRun === null ? this.pollingSince > 0 : isRunning(state.headRun)
    if (polling && waiting) this.timer = setTimeout(() => { void this.refresh() }, POLL_MS)
    else this.pollingSince = 0
  }

  private publish(state: RemoteState | null): void {
    this.state = state
    this.changed.fire(state)
  }
}
