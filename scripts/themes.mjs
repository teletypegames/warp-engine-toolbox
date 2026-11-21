// Builds the Teletype Games color themes (Dark, Light, Retro) from the brand's tokens in themes/source/;
// --check fails when a theme file is out of date or a text color is below its contrast minimum.
import { readFileSync, writeFileSync } from 'node:fs'

const TOKENS = 'themes/source/tokens.css'
const RETRO = 'themes/source/retro.css'
const MIN_TEXT = 4.5
const MIN_QUIET = 3

function blocks(file) {
  const text = readFileSync(file, 'utf8')
  const result = {}
  for (const [, selector, body] of text.matchAll(/([^{}/]+)\{([^}]*)\}/g)) {
    const vars = {}
    for (const [, name, value] of body.matchAll(/--c-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g).map((m) => [m[0], m[1], [m[2], m[3], m[4]]])) {
      vars[name] = `#${value.map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
    }
    result[selector.trim()] = vars
  }
  return result
}

function palettes() {
  const tokens = blocks(TOKENS)
  const light = tokens[':root']
  const dark = { ...light, ...tokens["[data-theme='dark']"] }
  const retro = { ...dark, info: '#00a8a8', ...blocks(RETRO)["[data-theme='retro']"], danger: '#ff5555' }
  return {
    dark: { label: 'Teletype Games - Dark', ui: 'vs-dark', c: dark, code: { keyword: dark.accent, type: dark['accent-hover'], string: dark.warn, number: dark.info, comment: dark['fg-subtle'] } },
    light: { label: 'Teletype Games - Light', ui: 'vs', c: light, code: { keyword: light.accent, type: light['accent-hover'], string: light.warn, number: light.info, comment: light['fg-subtle'] } },
    retro: { label: 'Teletype Games - Retro', ui: 'vs-dark', c: retro, code: { keyword: '#ffff55', type: '#ffffff', string: '#55ffff', number: '#55ff55', comment: retro['fg-subtle'] } }
  }
}

function workbench(c) {
  return {
    foreground: c.fg, descriptionForeground: c['fg-muted'], errorForeground: c.danger, focusBorder: c.accent,
    'widget.border': c.line, 'contrastBorder': undefined, 'selection.background': c['accent-quiet'], 'icon.foreground': c['fg-muted'],
    'editor.background': c.page, 'editor.foreground': c.fg, 'editorLineNumber.foreground': c['fg-subtle'], 'editorLineNumber.activeForeground': c.fg,
    'editorCursor.foreground': c.accent, 'editor.selectionBackground': c['accent-quiet'], 'editor.inactiveSelectionBackground': c.raised,
    'editor.lineHighlightBackground': c.surface, 'editor.lineHighlightBorder': c.surface, 'editorIndentGuide.background1': c.line, 'editorIndentGuide.activeBackground1': c['line-strong'],
    'editorWhitespace.foreground': c.line, 'editorBracketMatch.border': c.accent, 'editorBracketMatch.background': c['accent-quiet'],
    'editorGutter.background': c.page, 'editorGroup.border': c.line, 'editorGroupHeader.tabsBackground': c.surface, 'editorGroupHeader.tabsBorder': c.line,
    'editorWidget.background': c.raised, 'editorWidget.border': c['line-strong'], 'editorSuggestWidget.background': c.raised, 'editorSuggestWidget.selectedBackground': c['accent-quiet'],
    'editorHoverWidget.background': c.raised, 'editorHoverWidget.border': c['line-strong'],
    'editorError.foreground': c.danger, 'editorWarning.foreground': c.warn, 'editorInfo.foreground': c.info,
    'tab.activeBackground': c.page, 'tab.activeForeground': c.fg, 'tab.activeBorderTop': c.accent, 'tab.inactiveBackground': c.surface, 'tab.inactiveForeground': c['fg-muted'], 'tab.border': c.line,
    'activityBar.background': c.page, 'activityBar.foreground': c.fg, 'activityBar.inactiveForeground': c['fg-subtle'], 'activityBar.border': c.line,
    'activityBar.activeBorder': c.accent, 'activityBarBadge.background': c.accent, 'activityBarBadge.foreground': c['accent-fg'],
    'sideBar.background': c.surface, 'sideBar.foreground': c.fg, 'sideBar.border': c.line, 'sideBarTitle.foreground': c.fg,
    'sideBarSectionHeader.background': c.surface, 'sideBarSectionHeader.foreground': c.fg, 'sideBarSectionHeader.border': c.line,
    'list.activeSelectionBackground': c['accent-quiet'], 'list.activeSelectionForeground': c.fg, 'list.inactiveSelectionBackground': c.raised,
    'list.hoverBackground': c.raised, 'list.focusOutline': c.accent, 'list.highlightForeground': c.accent, 'list.errorForeground': c.danger, 'list.warningForeground': c.warn,
    'titleBar.activeBackground': c.page, 'titleBar.activeForeground': c.fg, 'titleBar.inactiveBackground': c.page, 'titleBar.inactiveForeground': c['fg-subtle'], 'titleBar.border': c.line,
    'statusBar.background': c.surface, 'statusBar.foreground': c['fg-muted'], 'statusBar.border': c.line, 'statusBar.noFolderBackground': c.surface,
    'statusBar.debuggingBackground': c.warn, 'statusBar.debuggingForeground': c['accent-fg'],
    'statusBarItem.remoteBackground': c.accent, 'statusBarItem.remoteForeground': c['accent-fg'], 'statusBarItem.hoverBackground': c.raised,
    'panel.background': c.surface, 'panel.border': c.line, 'panelTitle.activeForeground': c.fg, 'panelTitle.activeBorder': c.accent, 'panelTitle.inactiveForeground': c['fg-subtle'],
    'terminal.background': c.page, 'terminal.foreground': c.fg, 'terminalCursor.foreground': c.accent,
    'input.background': c.raised, 'input.foreground': c.fg, 'input.border': c['line-strong'], 'input.placeholderForeground': c['fg-subtle'],
    'inputOption.activeBorder': c.accent, 'dropdown.background': c.raised, 'dropdown.border': c['line-strong'], 'dropdown.foreground': c.fg,
    'button.background': c.accent, 'button.foreground': c['accent-fg'], 'button.hoverBackground': c['accent-hover'],
    'button.secondaryBackground': c.raised, 'button.secondaryForeground': c.fg, 'button.secondaryHoverBackground': c['line-strong'],
    'badge.background': c.accent, 'badge.foreground': c['accent-fg'], 'progressBar.background': c.accent,
    'textLink.foreground': c.accent, 'textLink.activeForeground': c['accent-hover'],
    'notifications.background': c.raised, 'notifications.border': c['line-strong'], 'notificationsInfoIcon.foreground': c.info,
    'notificationsWarningIcon.foreground': c.warn, 'notificationsErrorIcon.foreground': c.danger,
    'gitDecoration.addedResourceForeground': c.accent, 'gitDecoration.modifiedResourceForeground': c.info,
    'gitDecoration.deletedResourceForeground': c.danger, 'gitDecoration.untrackedResourceForeground': c.accent, 'gitDecoration.ignoredResourceForeground': c['fg-subtle'],
    'scrollbarSlider.background': `${c['line-strong']}99`, 'scrollbarSlider.hoverBackground': c['line-strong'], 'scrollbarSlider.activeBackground': c['fg-subtle']
  }
}

function tokenColors(c, code) {
  const rule = (scope, foreground, fontStyle) => ({ scope, settings: fontStyle ? { foreground, fontStyle } : { foreground } })
  return [
    rule(['comment', 'punctuation.definition.comment'], code.comment, 'italic'),
    rule(['string', 'string.quoted', 'string.template'], code.string),
    rule(['constant.numeric', 'constant.language', 'constant.character', 'constant.other', 'variable.other.constant', 'support.constant'], code.number),
    rule(['keyword', 'keyword.control', 'keyword.instructions', 'storage', 'storage.type', 'storage.modifier'], code.keyword),
    rule(['keyword.operator', 'punctuation'], c['fg-muted']),
    rule(['entity.name.type', 'entity.name.class', 'entity.other.inherited-class', 'support.type', 'support.class', 'meta.preprocessor', 'keyword.other.directive', 'entity.name.namespace'], code.type),
    rule(['entity.name.function', 'support.function', 'meta.function-call entity.name.function'], c.fg, 'bold'),
    rule(['variable', 'variable.parameter', 'variable.other'], c.fg),
    rule(['entity.name.tag', 'markup.heading'], code.keyword),
    rule(['markup.bold'], c.fg, 'bold'),
    rule(['markup.italic'], c.fg, 'italic'),
    rule(['markup.inline.raw', 'markup.fenced_code'], code.string),
    rule(['invalid', 'keyword.illegal'], c.danger)
  ]
}

function theme(p) {
  const colors = Object.fromEntries(Object.entries(workbench(p.c)).filter(([, value]) => value !== undefined))
  return {
    $schema: 'vscode://schemas/color-theme', name: p.label, type: p.ui === 'vs' ? 'light' : 'dark', semanticHighlighting: true, colors,
    tokenColors: tokenColors(p.c, p.code),
    semanticTokenColors: { function: { foreground: p.c.fg, bold: true }, method: { foreground: p.c.fg, bold: true }, type: p.code.type, class: p.code.type, namespace: p.code.type, keyword: p.code.keyword, number: p.code.number, string: p.code.string, comment: { foreground: p.code.comment, italic: true }, 'variable.readonly': p.code.number }
  }
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function contrastProblems(name, p) {
  const pairs = [
    ['keyword', p.code.keyword, p.c.page, MIN_TEXT], ['type', p.code.type, p.c.page, MIN_TEXT], ['string', p.code.string, p.c.page, MIN_TEXT],
    ['number', p.code.number, p.c.page, MIN_TEXT], ['comment', p.code.comment, p.c.page, MIN_QUIET], ['text', p.c.fg, p.c.page, MIN_TEXT],
    ['side bar text', p.c.fg, p.c.surface, MIN_TEXT], ['muted text', p.c['fg-muted'], p.c.surface, MIN_TEXT],
    ['button', p.c['accent-fg'], p.c.accent, MIN_TEXT], ['selection text', p.c.fg, p.c['accent-quiet'], MIN_TEXT],
    ['error in a list', p.c.danger, p.c.surface, MIN_QUIET], ['warning in a list', p.c.warn, p.c.surface, MIN_QUIET]
  ]
  return pairs.filter(([, fg, bg, min]) => contrast(fg, bg) < min).map(([what, fg, bg, min]) => `${name}: ${what} ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}:1, below ${min}:1`)
}

const built = Object.entries(palettes()).map(([name, p]) => ({ name, p, file: `themes/teletype-games-${name}.json`, text: `${JSON.stringify(theme(p), null, 2)}\n` }))
if (process.argv.includes('--check')) {
  const problems = built.flatMap(({ name, p, file, text }) => {
    let current = null
    try { current = readFileSync(file, 'utf8') } catch { current = null }
    return [...(current === text ? [] : [`${file} is out of date: run npm run themes`]), ...contrastProblems(name, p)]
  })
  for (const problem of problems) console.error(problem)
  process.exit(problems.length > 0 ? 1 : 0)
}
for (const { file, text } of built) writeFileSync(file, text)
for (const { name, p } of built) for (const problem of contrastProblems(name, p)) console.warn(problem)
