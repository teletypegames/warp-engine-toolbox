import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CALL = /\b(?:t|msg)\(\s*'((?:[^'\\]|\\.)*)'/g
const BASE = 'l10n/bundle.l10n.json'
const TRANSLATIONS = ['l10n/bundle.l10n.hu.json']
const MANIFEST = 'package.nls.json'
const MANIFEST_TRANSLATIONS = ['package.nls.hu.json']

function sources() {
  return readdirSync('src', { recursive: true }).filter((file) => file.endsWith('.ts')).map((file) => join('src', file))
}

function texts() {
  const found = new Set()
  for (const file of sources()) {
    for (const match of readFileSync(file, 'utf8').matchAll(CALL)) found.add(match[1].replace(/\\'/g, "'"))
  }
  return [...found].sort((a, b) => a.localeCompare(b))
}

function missing(base, file) {
  const translated = JSON.parse(readFileSync(file, 'utf8'))
  const keys = Object.keys(base)
  return { file, missing: keys.filter((key) => !translated[key]), stale: Object.keys(translated).filter((key) => !(key in base)) }
}

const keys = texts()
const base = Object.fromEntries(keys.map((key) => [key, key]))
if (process.argv.includes('--check')) {
  const written = JSON.parse(readFileSync(BASE, 'utf8'))
  const problems = [
    ...(JSON.stringify(written) === JSON.stringify(base) ? [] : [`${BASE} is out of date: run npm run l10n`]),
    ...[...TRANSLATIONS.map((file) => missing(base, file)), ...MANIFEST_TRANSLATIONS.map((file) => missing(JSON.parse(readFileSync(MANIFEST, 'utf8')), file))]
      .flatMap(({ file, missing: absent, stale }) => [...absent.map((key) => `${file}: no translation for "${key}"`), ...stale.map((key) => `${file}: "${key}" is no longer used`)])
  ]
  for (const problem of problems) console.error(problem)
  process.exit(problems.length > 0 ? 1 : 0)
}
writeFileSync(BASE, `${JSON.stringify(base, null, 2)}\n`)
console.log(`${BASE}: ${String(keys.length)} texts`)
