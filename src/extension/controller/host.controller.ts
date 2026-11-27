/**
 * Choosing the WarpEngine host the toolbox works with.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { HostUrl, type Host } from '../../domain/model/host.model'
import type { HostService } from '../../domain/service/host.service'
import { Dialogs, type ActionPickItem, type PickAction, type PickAnswer } from '../ui/dialogs'
import { t } from '../ui/l10n'

const ANOTHER: string | null = null
const EDIT = 'edit'
const REMOVE = 'remove'

/** Serves `warpengine.selectHost` and asks for a host whenever a flow needs one and none is set. */
export class HostController {
  /**
   * Creates the controller.
   *
   * @param hosts - The configured hosts.
   */
  public constructor(private readonly hosts: HostService) {}

  /**
   * Returns the current host, or asks for one when none is set.
   *
   * @returns The host, or `null` when the user cancelled.
   */
  public async ensure(): Promise<Host | null> {
    return this.hosts.current() ?? (await this.select())
  }

  /**
   * `warpengine.selectHost`: offers the known hosts in a quick pick, or an input box for another address, and makes the chosen one current.
   *
   * A configured host has an edit button (its address and name in two input boxes) and a remove button (after a confirmation);
   * after either the pick opens again. Writes the choices to the settings.
   *
   * @returns The chosen host, or `null` when the user cancelled.
   */
  public async select(): Promise<Host | null> {
    for (;;) {
      const choices: Host[] = this.hosts.choices()
      const picked: PickAnswer<string | null> | undefined = choices.length > 0 ? await this.pick(choices) : { value: ANOTHER }
      if (picked === undefined) return null
      if (picked.value === null) return this.another()
      if (!picked.action) return this.hosts.select(picked.value)
      await this.act(picked.action, picked.value, choices)
    }
  }

  private async another(): Promise<Host | null> {
    const typed: string | undefined = await this.askUrl()
    return typed ? this.hosts.choose(typed) : null
  }

  private async act(action: string, url: string, choices: readonly Host[]): Promise<void> {
    if (action === EDIT) await this.edit(choices.find((host: Host) => host.url === url))
    if (action === REMOVE) await this.remove(url)
  }

  private async pick(choices: readonly Host[]): Promise<PickAnswer<string | null> | undefined> {
    const actions: PickAction[] = [
      { id: EDIT, icon: 'edit', tooltip: t('Change the address or the name') },
      { id: REMOVE, icon: 'trash', tooltip: t('Remove from the hosts') }
    ]
    const items: ActionPickItem<string | null>[] = [
      ...choices.map((host: Host) => ({
        label: host.name, description: host.url, value: host.url, actions: this.hosts.editable(host.url) ? actions : []
      })),
      { label: `$(add) ${t('Another host…')}`, value: ANOTHER }
    ]
    return Dialogs.pickWithActions(items, { title: t('WarpEngine host'), placeHolder: this.hosts.current()?.url ?? t('Choose the host to work with') })
  }

  private async edit(host: Host | undefined): Promise<void> {
    if (!host) return
    const url: string | undefined = await this.askUrl(host.url)
    if (!url) return
    const name: string | undefined = await Dialogs.input({
      title: t('WarpEngine host name'), prompt: t('The name the toolbox shows for the host; empty: made of the address'), value: host.name, ignoreFocusOut: true
    })
    if (name === undefined) return
    await this.hosts.update(host.url, url, name)
  }

  private async remove(url: string): Promise<void> {
    if (await Dialogs.confirm(t('Remove {0} from the WarpEngine hosts?', url), t('Remove'))) await this.hosts.remove(url)
  }

  private async askUrl(value?: string): Promise<string | undefined> {
    return vscode.window.showInputBox({
      title: t('WarpEngine host URL'), prompt: t('The address of the site that runs WarpEngine'), placeHolder: 'https://games.example.org', value,
      ignoreFocusOut: true, validateInput: (typed: string) => HostUrl.isWeb(typed) ? null : t('An http(s) URL')
    })
  }
}
