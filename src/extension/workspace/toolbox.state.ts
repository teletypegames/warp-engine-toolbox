/**
 * Everything the toolbox keeps in VS Code: its settings, its stored sessions and its global and workspace state.
 *
 * @module
 */
import * as vscode from 'vscode'

const SECTION = 'warpengine'

/** Clears what the toolbox keeps in VS Code, for a reset. */
export class ToolboxState {
  /**
   * Creates the state.
   *
   * @param context - The extension context: its manifest (the settings it contributes), its secrets and mementos.
   */
  public constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Counts the settings the toolbox contributes that are set anywhere (user, workspace or a folder).
   *
   * @returns How many are set.
   */
  public setSettings(): number {
    const configuration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(SECTION)
    return this.settingKeys().filter((key: string) => {
      const inspected = configuration.inspect(key)
      return inspected?.globalValue !== undefined || inspected?.workspaceValue !== undefined || inspected?.workspaceFolderValue !== undefined
    }).length
  }

  /**
   * Removes every toolbox setting from the user settings, the workspace and each workspace folder, the stored
   * sessions from the secret storage, and every key of the global and workspace state.
   */
  public async clear(): Promise<void> {
    for (const key of this.settingKeys()) {
      await vscode.workspace.getConfiguration(SECTION).update(key, undefined, vscode.ConfigurationTarget.Global)
      if (vscode.workspace.workspaceFolders) await vscode.workspace.getConfiguration(SECTION).update(key, undefined, vscode.ConfigurationTarget.Workspace)
      for (const folder of vscode.workspace.workspaceFolders ?? []) await vscode.workspace.getConfiguration(SECTION, folder.uri).update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder)
    }
    await this.context.secrets.delete(`${SECTION}.sessions`)
    for (const memento of [this.context.globalState, this.context.workspaceState]) {
      for (const key of memento.keys()) await memento.update(key, undefined)
    }
  }

  private settingKeys(): string[] {
    const manifest = this.context.extension.packageJSON as { contributes?: { configuration?: { properties?: Record<string, unknown> } } }
    return Object.keys(manifest.contributes?.configuration?.properties ?? {}).map((key: string) => key.slice(SECTION.length + 1))
  }
}
