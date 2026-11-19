import { build } from 'esbuild'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

await build({ entryPoints: ['src/extension/bootstrap/main.ts'], outfile: 'dist/extension.js', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'], sourcemap: true })
await build({ entryPoints: ['test/integration/suite.ts'], outfile: 'dist-test/integration.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'] })

const workspace = mkdtempSync(join(tmpdir(), 'warp-workspace-'))
writeFileSync(join(workspace, '.woodpecker.yaml'), 'platform: c64\n')
writeFileSync(join(workspace, 'metadata.json'), JSON.stringify({ name: 'rabbit', version: '1.0.0', colour: 'red' }, null, 2))
writeFileSync(join(workspace, 'Makefile'), 'PROJECT = rabbit\n\nbuild:\n\tprintf "\\001\\010" > $(PROJECT).prg\n\nrun: build\n\t@echo run\n')
mkdirSync(join(workspace, '.vscode'), { recursive: true })
const localData = process.env.WARPENGINE_TEST_LOCAL_DATA
const hostSettings = localData ? { 'warpengine.localData': localData } : { 'warpengine.url': process.env.WARPENGINE_TEST_URL ?? 'https://teletypegames.org' }
writeFileSync(join(workspace, '.vscode', 'settings.json'), JSON.stringify({ ...hostSettings, 'warpengine.checkOnSave': false, 'task.allowAutomaticTasks': 'off' }))

const version = process.env.VSCODE_TEST_VERSION ?? 'stable'
let executable = await downloadAndUnzipVSCode(version)
const renamed = join(dirname(executable), 'Code')
if (!existsSync(executable) && existsSync(renamed)) executable = renamed

await runTests({
  vscodeExecutablePath: executable,
  extensionDevelopmentPath: resolve('.'),
  extensionTestsPath: resolve('scripts/integration-entry.cjs'),
  extensionTestsEnv: localData ? { WARPENGINE_TEST_LOCAL: '1', WARPENGINE_TEST_REMOTE: process.env.WARPENGINE_TEST_REMOTE ?? '', WARPENGINE_TEST_REMOTE_TOKEN: process.env.WARPENGINE_TEST_REMOTE_TOKEN ?? '', WARPENGINE_TEST_LOCAL_CI: process.env.WARPENGINE_TEST_LOCAL_CI ?? '' } : {},
  launchArgs: [workspace, '--disable-extensions', '--skip-welcome', '--skip-release-notes'],
})
