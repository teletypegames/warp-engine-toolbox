/**
 * Choosing the WarpEngine host the toolbox works with.
 *
 * @packageDocumentation
 */

import * as vscode from 'vscode'
import { HostUrl, type Host } from '../../domain/model/host.model'
import type { HostService } from '../../domain/service/host.service'
import { Dialogs, type PickItem } from '../ui/dialogs'
import { t } from '../ui/l10n'

const ANOTHER: string | null = null

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
   * Writes the choice to the settings.
   *
   * @returns The chosen host, or `null` when the user cancelled.
   */
  public async select(): Promise<Host | null> {
    const choices: Host[] = this.hosts.choices()
    const picked: string | null | undefined = choices.length > 0 ? await this.pick(choices) : ANOTHER
    if (picked === undefined) return null
    if (picked !== null) return this.hosts.select(picked)
    const typed: string | undefined = await this.askUrl()
    return typed ? this.hosts.choose(typed) : null
  }

  private async pick(choices: readonly Host[]): Promise<string | null | undefined> {
    const items: PickItem<string | null>[] = [
      ...choices.map((host: Host) => ({ label: host.name, description: host.url, value: host.url })),
      { label: `$(add) ${t('Another host…')}`, value: ANOTHER }
    ]
    return Dialogs.pick(items, { title: t('WarpEngine host'), placeHolder: this.hosts.current()?.url ?? t('Choose the host to work with') })
  }

  private async askUrl(): Promise<string | undefined> {
    return vscode.window.showInputBox({
      title: t('WarpEngine host URL'), prompt: t('The address of the site that runs WarpEngine'), placeHolder: 'https://games.example.org',
      ignoreFocusOut: true, validateInput: (value: string) => HostUrl.isWeb(value) ? null : t('An http(s) URL')
    })
  }
}
