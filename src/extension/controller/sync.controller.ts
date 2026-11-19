/**
 * Sync to… and the Sync view: the local engine's releases sent on to another WarpEngine instance.
 *
 * @packageDocumentation
 */

import * as os from 'node:os'
import * as vscode from 'vscode'
import type { Host } from '../../domain/model/host.model'
import { HostUrl } from '../../domain/model/host.model'
import { CHANNELS, DEFAULT_CHANNELS, type SyncLink, type SyncPush } from '../../domain/model/sync.model'
import type { HostService } from '../../domain/service/host.service'
import type { Paired, SyncService, SyncTarget } from '../../domain/service/sync.service'
import { Dialogs, type PickItem } from '../ui/dialogs'
import { t } from '../ui/l10n'
import type { TreeNode } from '../view/tree/tree.node'
import type { TreeProvider } from '../view/tree/tree.provider'

/** What {@link SyncController} works with. */
export interface SyncDependencies {
  /** Pairs the engines and manages the sync links. */
  readonly sync: SyncService
  /** The known hosts, the pairing targets. */
  readonly hosts: HostService
  /** The Sync view, redrawn after a change. */
  readonly tree: TreeProvider
}

const ADD_ENGINE = '\u0000add'

/**
 * Serves `warpengine.syncTo`, `warpengine.syncPushNow`, `warpengine.syncEditChannels`, `warpengine.syncCheck` and `warpengine.syncDisconnect`.
 */
export class SyncController {
  /**
   * Creates the controller.
   *
   * @param deps - The services and the view it uses.
   */
  public constructor(private readonly deps: SyncDependencies) {}

  /**
   * `warpengine.syncTo`: pairs the local engine with another WarpEngine instance.
   *
   * Asks for the target (a known host or a new address), signs in to it when needed (switching the current host there and back), asks for the channels and the name the target will call this engine, pairs with a progress notification, redraws the Sync view and offers to push what is here already.
   */
  public async syncTo(): Promise<void> {
    const target: Host | undefined = await this.chooseTarget()
    if (!target || !(await this.ensureSignedIn(target))) return
    const channels: string[] | undefined = await SyncController.chooseChannels(DEFAULT_CHANNELS)
    if (!channels) return
    const label: string | undefined = await Dialogs.input({ prompt: t('How {0} will call this engine', target.name), value: `${os.hostname()} local` })
    if (!label) return
    const paired: Paired = await Dialogs.progress(t('Pairing with {0}…', target.name), async () => this.deps.sync.pair(target, channels, label))
    this.deps.tree.refresh()
    await this.reportPaired(target, paired)
  }

  /**
   * `warpengine.syncPushNow`: queues every release of a sync link for sending, reports how many went and redraws the Sync view.
   *
   * @param node - The partner node; without one, the only link or the one picked in a quick pick.
   */
  public async pushNow(node?: TreeNode): Promise<void> {
    const link: SyncLink | undefined = await this.linkOf(node)
    if (link) await this.push(link)
  }

  /**
   * `warpengine.syncEditChannels`: asks for the channels that go to a partner, saves them and redraws the Sync view.
   *
   * @param node - The partner node; without one, the only link or the one picked in a quick pick.
   */
  public async editChannels(node?: TreeNode): Promise<void> {
    const link: SyncLink | undefined = await this.linkOf(node)
    if (!link) return
    const channels: string[] | undefined = await SyncController.chooseChannels(link.channels)
    if (!channels) return
    await this.deps.sync.setChannels(link, channels)
    this.deps.tree.refresh()
  }

  /**
   * `warpengine.syncCheck`: asks a partner whether it takes our pushes and reports the answer in a notification.
   *
   * @param node - The partner node; without one, the only link or the one picked in a quick pick.
   */
  public async check(node?: TreeNode): Promise<void> {
    const link: SyncLink | undefined = await this.linkOf(node)
    if (!link) return
    const result = await this.deps.sync.check(link)
    if (result.ok) Dialogs.info(t('{0} takes our pushes ({1}).', link.peer.label, result.version ?? '?'))
    else Dialogs.error(t('{0} does not take our pushes: {1}', link.peer.label, result.message))
  }

  /**
   * `warpengine.syncDisconnect`: after a confirmation, stops syncing to a partner and removes the pairing there too when signed in to it.
   *
   * Redraws the Sync view and reports whether the pairing was removed on both sides.
   *
   * @param node - The partner node; without one, the only link or the one picked in a quick pick.
   */
  public async disconnect(node?: TreeNode): Promise<void> {
    const link: SyncLink | undefined = await this.linkOf(node)
    if (!link || !(await Dialogs.confirm(t('Stop syncing to {0}? The releases already there stay.', link.peer.label), t('Disconnect')))) return
    const unpaired: boolean = await this.deps.sync.disconnect(link)
    this.deps.tree.refresh()
    Dialogs.info(unpaired ? t('Disconnected from {0}.', link.peer.label)
      : t('Disconnected here; sign in to {0} to remove the pairing there too, or leave it: its token no longer has a sender.', link.peer.label))
  }

  private async chooseTarget(): Promise<Host | undefined> {
    const targets: SyncTarget[] = await Dialogs.progress(t('Looking at the engines you know…'), async () => this.deps.sync.pairableTargets())
    const items: PickItem<string>[] = targets.map((target: SyncTarget) => ({
      label: target.host.name, value: target.host.url, description: target.signedIn ? t('signed in') : t('needs a sign-in'), detail: target.host.url
    }))
    items.push({ label: `$(add) ${t('Another engine…')}`, value: ADD_ENGINE })
    const picked: string | undefined = await Dialogs.pick(items, { placeHolder: t('Where should this engine\'s releases go?') })
    if (picked !== ADD_ENGINE) return targets.find((target: SyncTarget) => target.host.url === picked)?.host
    const url: string | undefined = await Dialogs.input({ prompt: t('The address of the WarpEngine to sync to'), value: 'https://',
      validateInput: (value: string): string | null => (HostUrl.isWeb(value) ? null : t('An http(s) address')) })
    return url ? this.deps.hosts.remember(url) : undefined
  }

  private async ensureSignedIn(target: Host): Promise<boolean> {
    if (await this.deps.sync.isSignedInTo(target)) return true
    const signIn: string = t('Sign in')
    if ((await Dialogs.ask(t('Pairing needs a sign-in to {0}. Sign in now? The Toolbox switches to it and back.', target.name), signIn)) !== signIn) return false
    const back: Host | null = this.deps.hosts.current()
    try {
      await this.deps.hosts.select(target.url)
      await vscode.commands.executeCommand('warpengine.signIn')
    } finally {
      if (back) await this.deps.hosts.select(back.url)
    }
    return this.deps.sync.isSignedInTo(target)
  }

  private async reportPaired(target: Host, paired: Paired): Promise<void> {
    if (!paired.check.ok) {
      Dialogs.error(t('Paired with {0}, but it does not take our pushes yet: {1}', target.name, paired.check.message))
      return
    }
    const push: string = t('Push now')
    const answer: string | undefined = await Dialogs.ask(t('This engine now syncs its {0} releases to {1}. Send what is here already?', paired.link.channels.join(' + '), target.name), push)
    if (answer === push) await this.push(paired.link)
  }

  private async push(link: SyncLink): Promise<void> {
    const push: SyncPush = await this.deps.sync.pushNow(link)
    Dialogs.info(t('{0} pushes queued to {1}.', push.queued, link.peer.label))
    this.deps.tree.refresh()
  }

  private async linkOf(node?: TreeNode): Promise<SyncLink | undefined> {
    const given: SyncLink | undefined = node?.data as SyncLink | undefined
    if (given) return given
    const links: SyncLink[] = await this.deps.sync.links()
    if (links.length <= 1) return links[0]
    return Dialogs.pick(links.map((link: SyncLink) => ({ label: link.peer.label, description: link.remoteUrl, value: link })), { placeHolder: t('Which engine?') })
  }

  private static async chooseChannels(chosen: readonly string[]): Promise<string[] | undefined> {
    const items: (vscode.QuickPickItem & { value: string })[] = CHANNELS.map((channel: string) => ({ label: channel, value: channel, picked: chosen.includes(channel) }))
    const picked: (vscode.QuickPickItem & { value: string })[] | undefined = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: t('Which channels go?') })
    if (!picked) return undefined
    return picked.length > 0 ? picked.map((item: { value: string }) => item.value) : undefined
  }
}
