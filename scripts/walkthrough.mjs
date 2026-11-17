import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron'

const host = process.env.WARPENGINE_TEST_URL ?? 'http://localhost:8080'
const name = process.env.WALK_NAME ?? `walk-${Date.now().toString(36)}`

await build({ entryPoints: ['src/extension/bootstrap/main.ts'], outfile: 'dist/extension.js', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'], sourcemap: true })
await build({ entryPoints: ['test/integration/walkthrough.ts'], outfile: 'dist-test/walkthrough.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'] })

const parent = mkdtempSync(join(tmpdir(), 'warp-walk-'))
const userData = mkdtempSync(join(tmpdir(), 'warp-walk-user-'))
mkdirSync(join(userData, 'User'), { recursive: true })
writeFileSync(join(userData, 'User', 'settings.json'), JSON.stringify({
  'warpengine.url': host, 'warpengine.checkOnSave': false, 'task.allowAutomaticTasks': 'off', 'security.workspace.trust.enabled': false
}))

let executable = await downloadAndUnzipVSCode(process.env.VSCODE_TEST_VERSION ?? 'stable')
const renamed = join(dirname(executable), 'Code')
if (!existsSync(executable) && existsSync(renamed)) executable = renamed

async function phase(label, workspace) {
  console.log(`${label} (${workspace})`)
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: resolve('.'),
    extensionTestsPath: resolve('scripts/walkthrough-entry.cjs'),
    launchArgs: [workspace, '--disable-extensions', '--skip-welcome', '--skip-release-notes', `--user-data-dir=${userData}`],
    extensionTestsEnv: { WALK_PHASE: label, WALK_PARENT: parent, WALK_NAME: name, WALK_PLATFORM: process.env.WALK_PLATFORM ?? 'phaser', WALK_START: process.env.WALK_START ?? 'demo' }
  })
}

function released(version) {
  const container = process.env.WALK_APP_CONTAINER ?? 'warpkittest-app-1'
  const ruby = `ActiveRecord::Base.logger = nil; print WarpEngine::Release.joins(:software).where(version: ${JSON.stringify(version)}, softwares: { name: ${JSON.stringify(name)} }).exists?`
  return execFileSync('docker', ['exec', container, 'bin/rails', 'runner', ruby], { encoding: 'utf8' }).trim().endsWith('true')
}

async function waitForRelease(version) {
  const deadline = Date.now() + 15 * 60_000
  while (!released(version)) {
    if (Date.now() > deadline) throw new Error(`${name} ${version} was not published within 15 minutes`)
    await new Promise((done) => setTimeout(done, 10_000))
  }
  console.log(`  ok  the CI published ${name} ${version}`)
}

await phase('new', parent)
await phase('connect', join(parent, name))
await waitForRelease('0.1.0')
await phase('release', join(parent, name))
await waitForRelease('0.1.1')
console.log(`walkthrough: ${name} went from New Game to two published releases`)
