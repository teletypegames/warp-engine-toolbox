import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const nls = JSON.parse(readFileSync('package.nls.json', 'utf8'))
const contributes = pkg.contributes

const text = (value) => {
  if (typeof value !== 'string') return ''
  const key = value.match(/^%(.+)%$/)?.[1]
  return (key ? nls[key] ?? value : value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
}
const code = (value) => `\`${String(value)}\``
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n')

const hidden = new Set((contributes.menus?.commandPalette ?? []).filter((item) => item.when === 'false').map((item) => item.command))
const commands = table(['Command', 'ID', 'Command Palette'], contributes.commands.map((command) =>
  [`${command.category ? `${command.category}: ` : ''}${text(command.title)}`, code(command.command), hidden.has(command.command) ? 'no' : 'yes']))

const configurations = Array.isArray(contributes.configuration) ? contributes.configuration : [contributes.configuration]
const settings = table(['Setting', 'Type', 'Default', 'Description'], configurations.flatMap((section) => Object.entries(section.properties).map(([key, property]) =>
  [code(key), property.type, code(JSON.stringify(property.default ?? null)), text(property.markdownDescription ?? property.description)])))

const views = table(['View', 'ID'], Object.values(contributes.views).flat().map((view) => [text(view.name), code(view.id)]))

const tasks = (contributes.taskDefinitions ?? []).map((definition) => [
  `Task type ${code(definition.type)}:`,
  '',
  table(['Property', 'Type', 'Required', 'Description'], Object.entries(definition.properties).map(([key, property]) =>
    [code(key), property.type, (definition.required ?? []).includes(key) ? 'yes' : 'no', text(property.description)]))
].join('\n')).join('\n\n')

const TOOLS = { 'warp-acme': 'ACME', 'warp-cc65': 'cc65', 'warp-gcc': 'gcc-style compilers', 'warp-lua': 'Lua' }
const matchers = table(['Problem matcher', 'Reads the output of'], (contributes.problemMatchers ?? []).map((matcher) => [code(`$${matcher.name}`), TOOLS[matcher.name] ?? matcher.name]))

const editors = table(['Custom editor', 'ID', 'Files'], (contributes.customEditors ?? []).map((editor) =>
  [text(editor.displayName), code(editor.viewType), editor.selector.map((selector) => code(selector.filenamePattern)).join(', ')]))

const schemas = table(['Validated file', 'Schema'], (contributes.jsonValidation ?? []).map((rule) => [code(rule.fileMatch), code(rule.url)]))

const page = `---
title: Commands and Settings
group: Guides
---

# Commands and Settings

What the WarpEngine Toolbox ${pkg.version} contributes to VS Code, generated from its \`package.json\`.

## Commands

${commands}

## Settings

${settings}

## Views

The *${text(contributes.viewsContainers.activitybar[0].title)}* view container in the activity bar:

${views}

## Tasks

${tasks}

${matchers}

## Editors and validation

${editors}

${schemas}
`

mkdirSync('docs/reference', { recursive: true })
writeFileSync('docs/reference/commands-and-settings.md', page)
