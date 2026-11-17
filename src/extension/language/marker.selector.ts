import type * as vscode from 'vscode'

export const MARKER_SELECTOR: vscode.DocumentSelector = [
  { pattern: '**/.woodpecker.{yaml,yml}' },
  { pattern: '**/.gitlab-ci.yml' }
]

export const PLATFORM_LINE = /^platform:\s*(\S+)/
