import type { PlatformDescription } from '../src/domain/types'

export const C64: PlatformDescription = {
  name: 'c64',
  label: 'C64',
  kinds: [
    { name: 'cartridge', upload: 'NAME-VERSION.prg', required: true, optional: false, built: true, always: true },
    { name: 'win_x64', upload: 'NAME-VERSION-win-x64.zip', required: false, optional: false, built: true, always: false },
    { name: 'mac_arm64', upload: 'NAME-VERSION-mac-arm64.zip', required: false, optional: false, built: false, always: false }
  ],
  metadata: { format: 'json', file: 'metadata.json', keys: ['name', 'title'] },
  version: { source: 'metadata', command: null },
  releaseRule: null,
  web: [{ key: 'emulatorjs', runtime: 'emulatorjs', label: 'EmulatorJS', payload: 'cartridge', default: true, params: [] }],
  ci: { adapter: 'Woodpecker', served: true, marker: { file: '.woodpecker.yaml', content: 'platform: c64\n' }, builder: 'registry/c64-builder' },
  tooling: { template: 'https://git.example/build/c64-tools', ref: 'master', extensions: ['rosc.vs64'] }
}

export const TIC80: PlatformDescription = {
  ...C64,
  name: 'tic80',
  label: 'TIC-80',
  metadata: { format: 'lua', file: null, keys: ['name', 'title'] },
  version: { source: 'command', command: "sed -n 's/^-- version: //p' inc/meta/meta.header.lua | head -n 1" },
  tooling: {}
}
