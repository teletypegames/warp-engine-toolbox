import { build, context } from 'esbuild'
import { readdirSync } from 'node:fs'
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
    outExtension: { '.js': '.cjs' }
  })
} else if (watch) {
  const ctx = await context(extension)
  await ctx.watch()
} else {
  await build(extension)
}
