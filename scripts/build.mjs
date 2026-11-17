import { build, context } from 'esbuild'
import { readdirSync } from 'node:fs'

const watch = process.argv.includes('--watch')
const production = process.argv.includes('--production')
const tests = process.argv.includes('--tests')

const extension = {
  entryPoints: ['src/extension/main.ts'],
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
    entryPoints: readdirSync('test').filter((name) => name.endsWith('.test.ts')).map((name) => `test/${name}`),
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
