import { build, context } from 'esbuild'
import { cpSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const watch = process.argv.includes('--watch')
const production = process.argv.includes('--production')
const tests = process.argv.includes('--tests')

const extension = {
  entryPoints: ['src/extension/bootstrap/main.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vscode'],
  mainFields: ['module', 'main'],
  sourcemap: !production,
  minify: production
}

if (tests) {
  await build({
    entryPoints: readdirSync('test/unit', { recursive: true }).filter((name) => name.endsWith('.test.ts')).map((name) => join('test/unit', name)),
    outbase: 'test/unit',
    outdir: 'dist-test',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    mainFields: ['module', 'main'],
    outExtension: { '.js': '.cjs' }
  })
} else if (watch) {
  copyDevContainerCli()
  const ctx = await context(extension)
  await ctx.watch()
} else {
  copyDevContainerCli()
  await build(extension)
}

function copyDevContainerCli() {
  const from = 'node_modules/@devcontainers/cli'
  const to = 'dist/devcontainer-cli'
  rmSync(to, { recursive: true, force: true })
  for (const part of ['devcontainer.js', 'package.json', 'LICENSE.txt', 'ThirdPartyNotices.txt', 'dist', 'scripts']) {
    cpSync(`${from}/${part}`, `${to}/${part}`, { recursive: true })
  }
}
