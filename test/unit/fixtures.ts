import type { PlatformDescription } from '../../src/domain/model/platform-description.model'
import { Platform } from '../../src/domain/model/platform.model'

export const C64_DESCRIPTION: PlatformDescription = {
  name: 'c64',
  label: 'C64',
  kinds: [
    { name: 'package', upload: 'NAME-VERSION.prg', required: true, optional: false, built: true, always: true },
    { name: 'win_x64', upload: 'NAME-VERSION-win-x64.zip', required: false, optional: false, built: true, always: false },
    { name: 'mac_arm64', upload: 'NAME-VERSION-mac-arm64.zip', required: false, optional: false, built: false, always: false }
  ],
  metadata: { format: 'json', file: 'metadata.json', keys: ['name', 'title'] },
  version: { source: 'metadata', command: null },
  releaseRule: null,
  web: [{ key: 'emulatorjs', runtime: 'emulatorjs', label: 'EmulatorJS', payload: 'package', default: true, params: [] }],
  ci: { adapter: 'Woodpecker', served: true, marker: { file: '.woodpecker.yaml', content: 'platform: c64\n' }, builder: 'registry/c64-builder' },
  tooling: { template: 'https://git.example/build/c64-tools', ref: 'master', extensions: ['rosc.vs64'], docs: 'https://wiki.example/platforms/c64' }
}

export const TIC80_DESCRIPTION: PlatformDescription = {
  ...C64_DESCRIPTION,
  name: 'tic80',
  label: 'TIC-80',
  metadata: { format: 'lua', file: null, keys: ['name', 'title'] },
  version: { source: 'command', command: "sed -n 's/^-- version: //p' inc/meta/meta.header.lua | head -n 1" },
  tooling: {}
}

export const ELECTRON_DESCRIPTION: PlatformDescription = {
  ...C64_DESCRIPTION,
  name: 'electron',
  label: 'Electron',
  version: { source: 'command', command: "sed -n 's/version//p' package.json", file: 'package.json' },
  web: [],
  tooling: {}
}

export const C64: Platform = new Platform(C64_DESCRIPTION)
export const ELECTRON: Platform = new Platform(ELECTRON_DESCRIPTION)
export const TIC80: Platform = new Platform(TIC80_DESCRIPTION)
