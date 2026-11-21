/**
 * Where a new project folder goes, and opening it: in its dev container, in this window, or added to the workspace.
 *
 * @module
 */
import { homedir } from 'node:os'
import * as vscode from 'vscode'
import type { DevContainerService } from '../../domain/service/dev-container.service'
import { Dialogs } from './dialogs'
import { t } from './l10n'

/** What {@link FolderOpenDialog.offer} offers to open. */
export interface FolderOffer {
  /** The folder. */
  readonly folder: string
  /** The message the buttons stand under. */
  readonly message: string
  /** Whether the folder has a dev container definition, which adds *Open in Container* when the Dev Containers extension is installed. */
  readonly devContainer: boolean
  /** Run once the user chose to open or add the folder, before it opens. */
  readonly beforeOpen?: () => Promise<void>
}

const DEV_CONTAINERS_EXTENSION = 'ms-vscode-remote.remote-containers'
const OPEN_IN_CONTAINER = 'remote-containers.openFolder'

/** Asks for a parent folder and offers to open a project folder, the way New Game, Clone and Fork do. */
export class FolderOpenDialog {
  /**
   * Creates the dialog.
   *
   * @param devContainers - Tells whether the Dev Containers extension would find Docker.
   */
  public constructor(private readonly devContainers: DevContainerService) {}

  /**
   * Asks for the folder a project's folder goes into, starting at `warpengine.defaultLocation` or the home folder.
   *
   * @param name - The project folder's name, shown in the title.
   * @param openLabel - The label of the dialog's confirming button.
   * @returns The chosen folder, or `null` when cancelled.
   */
  public static async askParent(name: string, openLabel: string): Promise<string | null> {
    const configured: string = (vscode.workspace.getConfiguration('warpengine').get<string>('defaultLocation') ?? '').trim()
    const parent: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
      title: t('Where should the {0} folder go?', name), canSelectFolders: true, canSelectFiles: false,
      defaultUri: vscode.Uri.file(configured || homedir()), openLabel
    })
    return parent?.[0]?.fsPath ?? null
  }

  /**
   * Offers *Open in Container* (when the folder has a dev container and the extension is installed), *Open* and
   * *Add to Workspace*, and does what is chosen. *Open in Container* opens the folder here when the Docker socket the
   * extension needs is missing, saying so.
   *
   * @param offer - The folder, the message, whether it has a dev container and what to run before opening.
   */
  public async offer(offer: FolderOffer): Promise<void> {
    const container: string | null = FolderOpenDialog.containerChoice(offer.devContainer)
    const open: string = t('Open')
    const answer: string | undefined = await Dialogs.ask(offer.message, ...(container ? [container] : []), open, t('Add to Workspace'))
    if (!answer) return
    const uri: vscode.Uri = vscode.Uri.file(offer.folder)
    if (offer.beforeOpen) await offer.beforeOpen()
    if (answer === container) await this.openInContainer(uri)
    else if (answer === open) await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false })
    else vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri })
  }

  private static containerChoice(devContainer: boolean): string | null {
    return devContainer && vscode.extensions.getExtension(DEV_CONTAINERS_EXTENSION) !== undefined ? t('Open in Container') : null
  }

  private async openInContainer(uri: vscode.Uri): Promise<void> {
    if (await this.devContainers.socketMissing()) {
      Dialogs.error(t('The Dev Containers extension connects to /var/run/docker.sock, which is missing here (OrbStack or Colima without its compatibility link). Turn that link on to open projects in their container; until then the project opens here, and its builds still run in the dev container.'))
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false })
      return
    }
    await vscode.commands.executeCommand(OPEN_IN_CONTAINER, uri)
  }
}
