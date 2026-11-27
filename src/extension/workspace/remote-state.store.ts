/**
 * The host-side state of the current project, polled while a build runs.
 *
 * @module
 */
import * as vscode from 'vscode'
import type { Release } from '../../domain/model/catalog.model'
import { PipelineRuns, type PipelineRun } from '../../domain/model/pipeline.model'
import type { Project } from '../../domain/model/project.model'
import type { RemoteState } from '../../domain/model/remote-state.model'
import type { RemoteStateService } from '../../domain/service/remote-state.service'
import type { ProjectRegistry } from './project.registry'

const POLL_MS = 10_000
const POLL_LIMIT_MS: number = 20 * 60_000

/**
 * Holds the {@link domain/model/remote-state.model!RemoteState} of the current project (its software, releases and
 * pipeline runs on the host) and tells the views when it changes.
 *
 * After {@link RemoteStateStore.watch}, or whenever a load finds the run of `HEAD` running (a push from a
 * terminal, a run started on the host), it polls every 10 seconds, for at most 20 minutes, while a run for
 * `HEAD` is running or, after a watch, has not appeared yet. When a run of `HEAD` it saw running has ended, it
 * fires {@link RemoteStateStore.onDidFinishRun}.
 */
export class RemoteStateStore implements vscode.Disposable {
  private readonly changed: vscode.EventEmitter<RemoteState | null> = new vscode.EventEmitter<RemoteState | null>()
  /** Fires with the new state after every load; `null` when there is no current project. */
  public readonly onDidChange: vscode.Event<RemoteState | null> = this.changed.event
  private readonly built: vscode.EventEmitter<RemoteState> = new vscode.EventEmitter<RemoteState>()
  /** Fires once per new branch build that appears while polling. */
  public readonly onDidBuildBranch: vscode.Event<RemoteState> = this.built.event
  private readonly ended: vscode.EventEmitter<RemoteState> = new vscode.EventEmitter<RemoteState>()
  /** Fires once when the run of `HEAD`, seen running, has ended; the state is the one loaded after it. */
  public readonly onDidFinishRun: vscode.Event<RemoteState> = this.ended.event
  private readonly announced: Set<string> = new Set<string>()
  private following: string | null = null
  private state: RemoteState | null = null
  private timer: NodeJS.Timeout | undefined
  private pollingSince = 0
  private loading: Promise<void> | null = null

  /**
   * Creates the store; it loads nothing until {@link RemoteStateStore.refresh} or {@link RemoteStateStore.watch}.
   *
   * @param service - Loads the state of a project from the host.
   * @param projects - Tells the current project.
   */
  public constructor(private readonly service: RemoteStateService, private readonly projects: ProjectRegistry) {}

  /**
   * Returns the last loaded state.
   *
   * @returns The state, or `null` before the first load or without a project.
   */
  public current(): RemoteState | null {
    return this.state
  }

  /** Starts polling, such as after a push or a release, and loads now. */
  public watch(): void {
    this.pollingSince = Date.now()
    void this.refresh()
  }

  /**
   * Loads the state of the current project from the host and fires {@link RemoteStateStore.onDidChange};
   * a call while a load runs waits for that load. Schedules the next poll when polling.
   */
  public async refresh(): Promise<void> {
    this.loading ??= this.load().finally(() => { this.loading = null })
    return this.loading
  }

  /** Stops polling and releases the event emitters. */
  public dispose(): void {
    if (this.timer) clearTimeout(this.timer)
    this.changed.dispose()
    this.built.dispose()
    this.ended.dispose()
  }

  private async load(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    const project: Project | null = this.projects.current()
    const state: RemoteState | null = project ? await this.service.load(project) : null
    this.publish(state)
    if (!state?.signedIn || state.error) return
    this.announce(state)
    this.follow(state)
    this.schedule(state)
  }

  private announce(state: RemoteState): void {
    const build: Release | null = state.branchBuild
    if (!build) return
    const key = `${String(build.id)}@${build.updatedAt ?? build.createdAt ?? ''}`
    if (this.pollingSince > 0 && !this.announced.has(key)) this.built.fire(state)
    this.announced.add(key)
  }

  private follow(state: RemoteState): void {
    const run: PipelineRun | null = state.headRun
    if (!run) return
    const key = `${state.project.folder}#${String(state.ciRepository?.id ?? '')}#${String(run.number)}`
    if (PipelineRuns.isRunning(run)) {
      this.following = key
      return
    }
    if (this.following === key) this.ended.fire(state)
    this.following = null
  }

  private schedule(state: RemoteState): void {
    if (this.pollingSince === 0 && PipelineRuns.isRunning(state.headRun)) this.pollingSince = Date.now()
    const polling: boolean = Date.now() - this.pollingSince < POLL_LIMIT_MS
    const waiting: boolean = state.headRun === null ? this.pollingSince > 0 : PipelineRuns.isRunning(state.headRun)
    if (polling && waiting) this.timer = setTimeout(() => { void this.refresh() }, POLL_MS)
    else this.pollingSince = 0
  }

  private publish(state: RemoteState | null): void {
    this.state = state
    this.changed.fire(state)
  }
}
