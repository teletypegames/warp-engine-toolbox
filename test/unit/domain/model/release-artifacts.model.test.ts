import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { AssetChecklist, type ChecklistEntry } from '../../../../src/domain/model/asset-checklist.model'
import { Changelog } from '../../../../src/domain/model/changelog.model'
import { C64 } from '../../fixtures'

describe('AssetChecklist', () => {
  it('marks what a release has, misses, and what the pipeline does not build', () => {
    const checklist: AssetChecklist = new AssetChecklist(C64, [{ id: 1, kind: 'package', path: '/x.prg' }])
    assert.deepEqual(checklist.entries.map((entry: ChecklistEntry) => `${AssetChecklist.mark(entry.state)} ${entry.kind}`), ['[x] package', '[ ] win_x64', '[-] mac_arm64'])
    assert.equal(checklist.missing, 1)
  })
})

describe('Changelog', () => {
  it('lists the commits since the last tag, without merges', () => {
    const entry: string = Changelog.entry('1.1.0', [{ sha: 'abcdef123', subject: 'Faster rabbit' }, { sha: '1234567aa', subject: 'Merge branch x' }], '2026-11-17')
    assert.equal(entry, '## 1.1.0 — 2026-11-17\n\n- Faster rabbit (abcdef1)\n')
    assert.equal(Changelog.prepend('# Changelog\n\n## 1.0.0\n', entry), `# Changelog\n\n${entry}\n## 1.0.0\n`)
  })
})
