/**
 * The table of the toolbox commands: command id to controller method.
 *
 * @module
 */
import type * as vscode from 'vscode'
import type { Controllers } from '../bootstrap/container'
import type { TreeNode } from '../view/tree/tree.node'
import type { CommandHandler } from './command.registry'

/** One command: its id, as contributed in `package.json`, and the handler that runs it. */
export type CommandRow = readonly [string, CommandHandler]

/**
 * Lists every `warpengine.*` command with the controller method it calls: the project,
 * account, catalog and sync commands.
 *
 * @param controllers - The controllers of the window.
 * @returns The rows for {@link extension/command/command.registry!CommandRegistry.register}.
 */
export function commandTable(controllers: Controllers): CommandRow[] {
  return [...projectCommands(controllers), ...accountCommands(controllers), ...catalogCommands(controllers), ...syncCommands(controllers)]
}

function projectCommands({ newGame, connect, project, release }: Controllers): CommandRow[] {
  return [
    ['warpengine.newGame', async (): Promise<void> => { await newGame.newGame() }],
    ['warpengine.addToProject', async (): Promise<void> => { await newGame.addToProject() }],
    ['warpengine.connect', async (): Promise<void> => { await connect.connect() }],
    ['warpengine.previewPipeline', async (): Promise<void> => { await project.previewPipeline() }],
    ['warpengine.play', async (): Promise<void> => { await project.play() }],
    ['warpengine.buildLikeCi', async (): Promise<void> => { await project.buildLikeCi() }],
    ['warpengine.checkPublish', async (): Promise<void> => { await project.checkPublish() }],
    ['warpengine.release', async (): Promise<void> => { await release.run() }],
    ['warpengine.editMetadata', async (uri?: vscode.Uri): Promise<void> => { await project.editMetadata(uri) }],
    ['warpengine.openPlatformDocs', async (node?: TreeNode): Promise<void> => { await project.openPlatformDocs(node) }]
  ]
}

function accountCommands({ signIn, host, refresh, link, localEngine }: Controllers): CommandRow[] {
  return [
    ['warpengine.installLocalEngine', async (): Promise<void> => { localEngine.install(); return Promise.resolve() }],
    ['warpengine.signIn', async (): Promise<void> => { await signIn.signIn() }],
    ['warpengine.signOut', async (): Promise<void> => { await signIn.signOut() }],
    ['warpengine.reauthorize', async (): Promise<void> => { await signIn.reauthorize() }],
    ['warpengine.selectHost', async (): Promise<void> => { await signIn.signInTo(await host.select()) }],
    ['warpengine.refresh', async (): Promise<void> => { await refresh.refresh() }],
    ['warpengine.openUrl', async (target?: string | TreeNode): Promise<void> => { await link.open(target) }],
    ['warpengine.copyLink', async (target?: string | TreeNode): Promise<void> => { await link.copy(target) }]
  ]
}

function syncCommands({ sync, images, localCi, servers }: Controllers): CommandRow[] {
  return [
    ['warpengine.purgeLocalEngine', async (): Promise<void> => { await servers.purge() }],
    ['warpengine.setupLocalCi', async (): Promise<void> => { await localCi.setUp() }],
    ['warpengine.syncTo', async (): Promise<void> => { await sync.syncTo() }],
    ['warpengine.syncPushNow', async (node?: TreeNode): Promise<void> => { await sync.pushNow(node) }],
    ['warpengine.syncEditChannels', async (node?: TreeNode): Promise<void> => { await sync.editChannels(node) }],
    ['warpengine.syncCheck', async (node?: TreeNode): Promise<void> => { await sync.check(node) }],
    ['warpengine.syncDisconnect', async (node?: TreeNode): Promise<void> => { await sync.disconnect(node) }],
    ['warpengine.addImage', async (node?: TreeNode): Promise<void> => { await images.add(node) }],
    ['warpengine.imageMakeDefault', async (node?: TreeNode): Promise<void> => { await images.makeDefault(node) }],
    ['warpengine.imageMoveUp', async (node?: TreeNode): Promise<void> => { await images.moveUp(node) }],
    ['warpengine.imageMoveDown', async (node?: TreeNode): Promise<void> => { await images.moveDown(node) }],
    ['warpengine.imageRemove', async (node?: TreeNode): Promise<void> => { await images.remove(node) }]
  ]
}

function catalogCommands({ catalog }: Controllers): CommandRow[] {
  return [
    ['warpengine.triggerPipeline', async (node?: TreeNode): Promise<void> => { await catalog.triggerPipeline(node) }],
    ['warpengine.editSoftwareField', async (node?: TreeNode): Promise<void> => { await catalog.editField(node) }],
    ['warpengine.showChecklist', async (node?: TreeNode): Promise<void> => { await catalog.showChecklist(node) }],
    ['warpengine.showStatistics', async (node?: TreeNode): Promise<void> => { await catalog.showStatistics(node) }],
    ['warpengine.deleteSoftware', async (node?: TreeNode): Promise<void> => { await catalog.deleteSoftware(node) }],
    ['warpengine.deleteRelease', async (node?: TreeNode): Promise<void> => { await catalog.deleteRelease(node) }]
  ]
}
