/**
 * Where the pipeline marker lives, for the marker editor features.
 *
 * @module
 */
import type * as vscode from 'vscode'

/** The documents that carry the pipeline marker: `.woodpecker.yaml`/`.yml` and `.gitlab-ci.yml` files. */
export const MARKER_SELECTOR: vscode.DocumentSelector = [
  { pattern: '**/.woodpecker.{yaml,yml}' },
  { pattern: '**/.gitlab-ci.yml' }
]

/** Matches a marker's `platform:` line at the start of a line; group 1 is the platform name. */
export const PLATFORM_LINE = /^platform:\s*(\S+)/
