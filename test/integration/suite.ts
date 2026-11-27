import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import type { Project } from '../../src/domain/model/project.model'
import type { PublishProblem } from '../../src/domain/model/publish-check.model'
import type { ToolboxApi } from '../../src/extension/bootstrap/toolbox.api'

async function until<T>(what: string, probe: () => T | null | undefined | Promise<T | null | undefined>, timeout: number = 20_000): Promise<T> {
  const deadline: number = Date.now() + timeout
  for (;;) {
    const value: T | null | undefined = await probe()
    if (value !== null && value !== undefined && value !== false) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((done: (value: unknown) => void) => setTimeout(done, 250))
  }
}

async function step(name: string, body: () => Promise<void>): Promise<void> {
  const started: number = Date.now()
  await body()
  console.log(`  ok  ${name} (${String(Date.now() - started)} ms)`)
}

async function runLocal(api: ToolboxApi): Promise<void> {
  await step('finds the local engine and makes it the host', async () => {
    const url: string = await until('the local host', () => api.hosts.current()?.url, 30_000)
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/)
    assert.match(api.hosts.current()?.name ?? '', /^Local \(/)
  })

  await step('signs in with the token file, without a device code', async () => {
    const session: vscode.AuthenticationSession = await api.auth.createSession([])
    assert.ok(session.accessToken.length > 20)
    assert.equal((await api.auth.getSessions()).length, 1)
  })

  await step('learns the project\'s platform from the local engine', async () => {
    const project: Project = await until('the project', () => api.projects.current())
    assert.equal(project.platform?.label, 'C64')
  })

  const remote: string = process.env['WARPENGINE_TEST_REMOTE'] ?? ''
  const token: string = process.env['WARPENGINE_TEST_REMOTE_TOKEN'] ?? ''
  if (remote && token) await runSync(api, remote, token)
  if (process.env['WARPENGINE_TEST_LOCAL_CI'] === '1') await runLocalCi(api)
}

async function runLocalCi(api: ToolboxApi): Promise<void> {
  await step('lists the engine, the git server and the CI in the Servers view', async () => {
    const names: string[] = (await api.servers.containers()).map((container) => container.name)
    assert.deepEqual(names.slice(0, 2), ['warp-engine-local', 'warp-engine-local-gitea'])
    assert.ok(names.includes('warp-engine-local-woodpecker'), names.join(', '))
  })

  await step('lists the local git server and CI', async () => {
    const keys: string[] = (await api.localCi.providers()).map((provider) => provider.key)
    assert.deepEqual(keys, ['gitea', 'woodpecker'])
  })

  await step('sets the project up on the local CI and pushes it to the wplocal remote', async () => {
    const steps: string[] = []
    const setup = await api.localCi.setUp(api.projects.require(), (message) => { steps.push(String(message.args[0] ?? message.text)) })
    assert.match(setup.pushUrl, /^http:\/\/warp:[^@]+@localhost:\d+\/games\/rabbit\.git$/)
    assert.equal(setup.remoteName, 'wplocal')
    assert.ok(steps.some((text) => text.includes('let warp push')), steps.join(' | '))
  })
}

async function runSync(api: ToolboxApi, remote: string, token: string): Promise<void> {
  await step('offers a signed-in engine that takes pairing as a sync target', async () => {
    await api.hosts.remember(remote)
    await api.signIn.createSession(remote, token, ['sync:pair'])
    const targets = await api.sync.targets()
    assert.ok(targets.some((target) => target.host.url === remote && target.pairable && target.signedIn), JSON.stringify(targets))
  })

  await step('pairs the local engine with it, and the remote engine takes the local one\'s pushes', async () => {
    const paired = await api.sync.pair({ name: 'Remote', url: remote }, ['stable', 'beta'], 'integration local')
    assert.ok(paired.check.ok, paired.check.message)
    assert.ok((await api.sync.links()).some((link) => link.remoteUrl === remote))
  })

  await step('disconnects on both sides', async () => {
    const link = (await api.sync.links()).find((item) => item.remoteUrl === remote)
    assert.ok(link)
    assert.equal(await api.sync.disconnect(link), true)
    assert.ok(!(await api.sync.links()).some((item) => item.remoteUrl === remote))
  })
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<ToolboxApi>('TeletypeGames.warpengine-toolbox')
  assert.ok(extension, 'the extension is installed')
  const api: ToolboxApi = await extension.activate()
  if (process.env['WARPENGINE_TEST_LOCAL'] === '1') {
    await runLocal(api)
    return
  }
  const folder: vscode.Uri = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('/')

  await step('detects the project and learns its platform from the host', async () => {
    const project: Project = await until('the project', () => api.projects.current())
    assert.equal(project.platformName, 'c64')
    assert.equal(project.platform?.label, 'C64')
    assert.equal(project.name, 'rabbit')
  })

  await step('serves the host schema for metadata.json', async () => {
    const schema = JSON.parse((await vscode.workspace.openTextDocument(vscode.Uri.parse('warpengine-schema://current/metadata.schema.json'))).getText()) as { required: string[] }
    assert.deepEqual(schema.required, ['name', 'title', 'version'])
  })

  await step('VS Code validates metadata.json against it', async () => {
    const uri: vscode.Uri = vscode.Uri.joinPath(folder, 'metadata.json')
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    const messages: string = await until('JSON schema diagnostics', () => {
      const found: string = vscode.languages.getDiagnostics(uri).map((item: vscode.Diagnostic) => item.message).join(' | ')
      return /title/i.test(found) ? found : null
    }, 30_000)
    assert.match(messages, /title/i)
  })

  await step('asks the host what a publish would refuse', async () => {
    const result = await api.diagnostics.check(api.projects.require(), false)
    assert.ok(result)
    assert.ok(result.problems.some((problem: PublishProblem) => problem.field === 'title' && problem.level === 'error'))
    assert.ok(result.problems.some((problem: PublishProblem) => problem.field === 'colour' && problem.level === 'warning'))
  })

  await step('offers the Makefile targets and the CI builder as tasks', async () => {
    const names: string[] = (await vscode.tasks.fetchTasks({ type: 'warpengine' })).map((task: vscode.Task) => task.name)
    assert.ok(names.includes('build'), names.join(', '))
    assert.ok(names.includes('build (CI builder)'), names.join(', '))
  })

  await step('completes the platform in the pipeline marker', async () => {
    const uri: vscode.Uri = vscode.Uri.joinPath(folder, '.woodpecker.yaml')
    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(uri)
    const line: number = document.getText().split('\n').findIndex((text: string) => text.startsWith('platform:'))
    const list: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', uri, new vscode.Position(line, document.lineAt(line).text.length))
    const labels: string[] = list.items.map((item: vscode.CompletionItem) => typeof item.label === 'string' ? item.label : item.label.label)
    assert.ok(labels.includes('tic80') && labels.includes('godot'), labels.join(', '))
  })

  await step('completes the marker keys the platform offers on a new line', async () => {
    const uri: vscode.Uri = vscode.Uri.joinPath(folder, '.woodpecker.yaml')
    const document: vscode.TextDocument = await vscode.workspace.openTextDocument(uri)
    const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
    edit.insert(uri, new vscode.Position(document.lineCount, 0), '\n')
    await vscode.workspace.applyEdit(edit)
    const line: number = document.lineCount - 1
    const list: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', uri, new vscode.Position(line, 0))
    const labels: string[] = list.items.map((item: vscode.CompletionItem) => typeof item.label === 'string' ? item.label : item.label.label)
    assert.ok(labels.includes('release') && labels.includes('build') && labels.includes('media'), labels.join(', '))
    await vscode.commands.executeCommand('workbench.action.files.revert', uri)
  })

  await step('builds and plays the local build in the host runtime', async () => {
    await api.player.play()
    const url: string = await until('the play URL', () => api.player.lastUrl, 60_000)
    assert.match(url, /\/play-preview\/c64\?payload=message/)
    const page: Response = await fetch(url)
    assert.equal(page.status, 200, `the host answered ${String(page.status)} for ${url}`)
    assert.match(await page.text(), /warpengine\.ready/)
  })

  await step('writes a new project from the host template', async () => {
    const platform = await api.platforms.find('c64')
    assert.ok(platform)
    const target: string = mkdtempSync(join(tmpdir(), 'warp-new-'))
    const result = await api.scaffold.write({
      folder: target, platform, host: api.hosts.require().url, withDemo: false, overwrite: true, report: () => undefined,
      answers: { name: 'hopper', title: 'Hopper', author: 'Test', license: 'MIT', category: null, description: 'Hops', version: '0.1.0' }
    })
    assert.ok(result.written.includes('Makefile') && result.written.includes('metadata.json') && result.written.includes('.woodpecker.yaml'), result.written.join(', '))
    assert.ok(readdirSync(target).includes('Makefile'))
  })

  await step('writes a golang GUI project with app: gui in its marker and an MIT LICENSE', async () => {
    const platform = await api.platforms.find('golang')
    assert.ok(platform)
    const target: string = mkdtempSync(join(tmpdir(), 'warp-go-'))
    const result = await api.scaffold.write({
      folder: target, platform, host: api.hosts.require().url, withDemo: false, overwrite: true, report: () => undefined,
      answers: { name: 'gopher-hop', title: 'Gopher Hop', author: 'Test', license: 'MIT', category: null, description: 'Hops', version: '0.1.0', app: 'gui' }
    })
    assert.ok(result.written.includes('.woodpecker.yaml'), result.written.join(', '))
    assert.match(readFileSync(join(target, '.woodpecker.yaml'), 'utf8'), /^app: gui$/m)
    assert.ok(existsSync(join(target, 'LICENSE')), readdirSync(target).join(', '))
    assert.match(readFileSync(join(target, 'LICENSE'), 'utf8'), /MIT License/)
  })
}
