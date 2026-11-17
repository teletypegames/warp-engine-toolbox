import * as vscode from 'vscode'
import type { PlatformDescription } from '../domain/types'
import type { Platforms } from './platforms'

const SELECTOR: vscode.DocumentSelector = [
  { pattern: '**/.woodpecker.{yaml,yml}' },
  { pattern: '**/.gitlab-ci.yml' }
]

export function registerMarkerSupport(platforms: Platforms): vscode.Disposable[] {
  return [
    vscode.languages.registerCompletionItemProvider(SELECTOR, {
      async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        const before: string = document.lineAt(position.line).text.slice(0, position.character)
        if (/^platform:\s*\S*$/.test(before)) {
          return (await platforms.all().catch((): PlatformDescription[] => [])).map((platform: PlatformDescription) => {
            const item: vscode.CompletionItem = new vscode.CompletionItem(platform.name, vscode.CompletionItemKind.EnumMember)
            item.detail = platform.label
            item.documentation = new vscode.MarkdownString(describe(platform))
            return item
          })
        }
        if (/^\w*$/.test(before) && position.character === before.length) {
          return ['platform', 'name', 'release', 'build'].map((key: string) => {
            const item: vscode.CompletionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property)
            item.insertText = `${key}: `
            item.detail = { platform: 'The WarpEngine platform that builds this repository', name: 'The software name when it differs from the repository name', release: 'tag: release only on version tags', build: 'How the platform builds (e.g. make)' }[key] ?? ''
            return item
          })
        }
        return []
      }
    }, ':', ' '),
    vscode.languages.registerHoverProvider(SELECTOR, {
      async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
        const match: RegExpExecArray | null = /^platform:\s*(\S+)/.exec(document.lineAt(position.line).text)
        if (!match?.[1]) return null
        const platform: PlatformDescription | undefined = (await platforms.all().catch((): PlatformDescription[] => [])).find((candidate: PlatformDescription) => candidate.name === match[1])
        return platform ? new vscode.Hover(new vscode.MarkdownString(describe(platform))) : null
      }
    }),
    vscode.languages.registerCodeLensProvider(SELECTOR, {
      provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const line: number = document.getText().split(/\r?\n/).findIndex((text: string) => text.startsWith('platform:'))
        if (line < 0) return []
        return [new vscode.CodeLens(document.lineAt(line).range, { title: 'Preview the pipeline WarpEngine serves', command: 'warpengine.previewPipeline' })]
      }
    })
  ]
}

export function describe(platform: PlatformDescription): string {
  const kinds: string = platform.kinds.map((kind) => `\`${kind.upload}\`${kind.required ? ' (required)' : ''}`).join(', ')
  const web: string = platform.web.length > 0 ? platform.web.map((binding) => `${binding.label ?? binding.runtime}${binding.default ? ' (default)' : ''}`).join(', ') : 'from its html build'
  return [
    `**${platform.label}** (\`${platform.name}\`)`,
    '',
    `- Publishes: ${kinds}`,
    `- Metadata: ${platform.metadata.format === 'json' ? `\`${platform.metadata.file ?? 'metadata.json'}\`` : platform.metadata.format === 'lua' ? 'Lua header comments' : 'host-specific'}`,
    `- Version from: ${platform.version.source === 'metadata' ? 'the metadata' : `\`${platform.version.command ?? ''}\``}`,
    `- Plays on the web: ${web}`,
    platform.releaseRule ? `- Releases only on: ${platform.releaseRule}` : '',
    platform.ci.builder ? `- Builder image: \`${platform.ci.builder}\`` : ''
  ].filter(Boolean).join('\n')
}
