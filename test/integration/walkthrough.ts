import { strict as assert } from 'node:assert'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import * as vscode from 'vscode'
import type { ToolboxApi } from '../../src/extension/main'

const exec = promisify(execFile)

interface Prompt { readonly kind: string; readonly title: string; readonly message: string }

const NAME: string = process.env['WALK_NAME'] ?? 'walk-demo'
const PLATFORM: string = process.env['WALK_PLATFORM'] ?? 'phaser'
const prompts: Prompt[] = []
const messages: string[] = []
const errors: string[] = []

async function step(name: string, body: () => Promise<void>): Promise<void> {
  const started: number = Date.now()
  await body()
  console.log(`  ok  ${name} (${String(Date.now() - started)} ms)`)
}

async function until<T>(what: string, probe: () => T | null | undefined, timeout: number): Promise<T> {
  const deadline: number = Date.now() + timeout
  for (;;) {
    const value: T | null | undefined = probe()
    if (value !== null && value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    await new Promise((done: (value: unknown) => void) => setTimeout(done, 250))
  }
}

type Item = string | (vscode.QuickPickItem & { readonly platform?: { readonly name: string } })

function pickAnswer(title: string, items: readonly Item[]): Item | undefined {
  const label = (item: Item): string => typeof item === 'string' ? item : item.label
  if (/platform/i.test(title)) return items.find((item: Item) => typeof item !== 'string' && item.platform?.name === PLATFORM)
  if (/licence/i.test(title)) return items.find((item: Item) => label(item) === 'MIT')
  if (/category/i.test(title)) return items[0]
  if (/starting point/i.test(title)) return items.find((item: Item) => label(item) === 'Start from the demo game')
  if (/push to the new repository/i.test(title)) return items.find((item: Item) => label(item) === 'HTTPS')
  if (title.endsWith(': channel')) return items.find((item: Item) => label(item) === 'Stable')
  if (title.endsWith(': stable version')) return items[0]
  return undefined
}

function inputAnswer(title: string, value: string | undefined): string | undefined {
  if (title.endsWith(': name')) return NAME
  if (/^title$/i.test(title)) return value
  if (/description/i.test(title)) return 'A game made by the WarpEngine walkthrough'
  if (/author/i.test(title)) return 'Walkthrough Studio'
  return undefined
}

function scriptDialogs(parent: string | null, opened: vscode.Uri[]): void {
  const window = vscode.window as unknown as Record<string, unknown>
  window['showQuickPick'] = async (items: readonly Item[] | Promise<readonly Item[]>, options?: vscode.QuickPickOptions): Promise<Item | undefined> => {
    const title: string = options?.title ?? options?.placeHolder ?? ''
    const answer: Item | undefined = pickAnswer(title, await items)
    prompts.push({ kind: 'pick', title, message: answer === undefined ? 'UNANSWERED' : typeof answer === 'string' ? answer : answer.label })
    return answer
  }
  window['showInputBox'] = (options?: vscode.InputBoxOptions): Promise<string | undefined> => {
    const title: string = options?.title ?? options?.prompt ?? ''
    const answer: string | undefined = inputAnswer(title, options?.value)
    prompts.push({ kind: 'input', title, message: answer ?? 'UNANSWERED' })
    return Promise.resolve(answer)
  }
  window['showOpenDialog'] = (options?: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> => {
    prompts.push({ kind: 'open', title: options?.title ?? '', message: parent ?? 'UNANSWERED' })
    return Promise.resolve(parent ? [vscode.Uri.file(parent)] : undefined)
  }
  window['showInformationMessage'] = (message: string): Promise<undefined> => { messages.push(message); return Promise.resolve(undefined) }
  window['showWarningMessage'] = (message: string): Promise<undefined> => { messages.push(`warning: ${message}`); return Promise.resolve(undefined) }
  window['showErrorMessage'] = (message: string): Promise<undefined> => { errors.push(message); return Promise.resolve(undefined) }
  const env = vscode.env as unknown as Record<string, unknown>
  env['openExternal'] = (uri: vscode.Uri): Promise<boolean> => { opened.push(uri); return Promise.resolve(true) }
}

async function approve(code: string): Promise<void> {
  const container: string = process.env['WALK_APP_CONTAINER'] ?? 'warpkittest-app-1'
  await exec('docker', ['exec', container, 'bin/rails', 'runner',
    `WarpEngine::DeviceGrantService.new.approve_tool(user_code: ${JSON.stringify(code)}, admin: AdminUser.first)`])
}

async function newGamePhase(): Promise<void> {
  const parent: string = process.env['WALK_PARENT'] ?? ''
  assert.ok(parent, 'WALK_PARENT is set')
  scriptDialogs(parent, [])
  await step(`New Game: a ${PLATFORM} game from the host's template and demo`, async () => {
    await vscode.commands.executeCommand('warpengine.newGame')
    const folder: string = join(parent, NAME)
    assert.deepEqual(errors, [])
    assert.ok(existsSync(join(folder, '.woodpecker.yaml')), 'the marker is written')
    assert.match(readFileSync(join(folder, '.woodpecker.yaml'), 'utf8'), new RegExp(`platform: ${PLATFORM}`))
    const metadata = JSON.parse(readFileSync(join(folder, 'metadata.json'), 'utf8')) as { name: string; author: string }
    assert.equal(metadata.name, NAME)
    assert.equal(metadata.author, 'Walkthrough Studio')
    assert.ok(existsSync(join(folder, '.git')), 'it is a git repository')
  })
}

function skipAccessConsent(api: ToolboxApi): void {
  let session: vscode.AuthenticationSession | null = null
  const authentication = vscode.authentication as unknown as Record<string, unknown>
  authentication['getSession'] = async (_provider: string, scopes: readonly string[], options?: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined> => {
    session ??= (await api.auth.getSessions())[0] ?? null
    if (!session && options?.createIfNone) session = await api.auth.createSession(scopes)
    return session ?? undefined
  }
}

async function connectPhase(api: ToolboxApi): Promise<void> {
  const opened: vscode.Uri[] = []
  scriptDialogs(null, opened)
  skipAccessConsent(api)
  await step('Sign In: the code is approved on the host as an administrator', async () => {
    const signIn: Thenable<unknown> = vscode.commands.executeCommand('warpengine.signIn')
    const code: string = await until('the sign-in code', () => {
      const line: string | undefined = messages.find((message: string) => message.startsWith('Approve the code '))
      return line?.match(/Approve the code (\S+)/)?.[1] ?? null
    }, 30_000)
    assert.ok(opened.some((uri: vscode.Uri) => uri.path.includes('tool_sign_in')), 'the approval page is opened')
    await approve(code)
    await signIn
    assert.deepEqual(errors, [])
  })
  await step('Connect: repository, CI and catalog entry, then the first push', async () => {
    await vscode.commands.executeCommand('warpengine.connect')
    assert.deepEqual(errors, [])
    const done: string | undefined = messages.find((message: string) => message.includes('is on WarpEngine'))
    assert.ok(done, `connect reported: ${messages.join(' | ')}`)
    assert.doesNotMatch(done, /Warnings:/)
  })
}

async function releasePhase(api: ToolboxApi): Promise<void> {
  scriptDialogs(null, [])
  skipAccessConsent(api)
  await step('Release: a stable version, its changelog and the tag pushed', async () => {
    await vscode.commands.executeCommand('warpengine.release')
    assert.deepEqual(errors, [])
    const pushed: string | undefined = messages.find((message: string) => message.includes(' is pushed;'))
    assert.ok(pushed, `release reported: ${messages.join(' | ')}`)
  })
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<ToolboxApi>('TeletypeGames.warpengine-toolbox')
  assert.ok(extension, 'the extension is installed')
  const api: ToolboxApi = await extension.activate()
  try {
    if (process.env['WALK_PHASE'] === 'connect') await connectPhase(api)
    else if (process.env['WALK_PHASE'] === 'release') await releasePhase(api)
    else await newGamePhase()
  } finally {
    for (const prompt of prompts) console.log(`      ${prompt.kind} ${prompt.title} → ${prompt.message}`)
    for (const message of messages) console.log(`      message: ${message}`)
    for (const message of errors) console.log(`      ERROR: ${message}`)
  }
}
