import { strict as assert } from 'node:assert'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import type { ToolboxApi } from '../../src/extension/main'
import { writeProject } from '../../src/extension/scaffolding'
import type { Project } from '../../src/extension/project'

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

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<ToolboxApi>('TeletypeGames.warpengine-toolbox')
  assert.ok(extension, 'the extension is installed')
  const api: ToolboxApi = await extension.activate()
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
    assert.ok(result.problems.some((problem) => problem.field === 'title' && problem.level === 'error'))
    assert.ok(result.problems.some((problem) => problem.field === 'colour' && problem.level === 'warning'))
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

  await step('builds and plays the local build in the host runtime', async () => {
    await api.player.play()
    const url: string = await until('the play URL', () => api.player.lastUrl, 60_000)
    assert.match(url, /\/play-preview\/c64\?payload=http%3A%2F%2F127\.0\.0\.1%3A\d+%2Frabbit\.prg/)
    const payload: string = decodeURIComponent(/payload=([^&]+)/.exec(url)?.[1] ?? '')
    assert.equal((await fetch(payload)).status, 200)
    const page: Response = await fetch(url)
    assert.equal(page.status, 200, `the host answered ${String(page.status)} for ${url}`)
    assert.equal(page.headers.get('x-frame-options'), null, 'the panel may frame the preview')
    assert.match(await page.text(), /127\.0\.0\.1/)
  })

  await step('writes a new project from the host template', async () => {
    const platform = await api.platforms.find('c64')
    assert.ok(platform)
    const target: string = mkdtempSync(join(tmpdir(), 'warp-new-'))
    const result = await writeProject({
      folder: target, platform, host: api.hosts.require().url, withDemo: false, overwrite: true, report: () => undefined,
      answers: { name: 'hopper', title: 'Hopper', author: 'Test', license: 'MIT', category: null, description: 'Hops', version: '0.1.0' }
    })
    assert.ok(result.written.includes('Makefile') && result.written.includes('metadata.json') && result.written.includes('.woodpecker.yaml'), result.written.join(', '))
    assert.ok(readdirSync(target).includes('Makefile'))
  })
}
