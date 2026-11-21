import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { DomainError } from '../../../../src/domain/model/message.model'
import { TasksDocument, type TasksMerge } from '../../../../src/domain/model/tasks-document.model'

const ADDITIONS = JSON.stringify({ version: '2.0.0', tasks: [{ label: 'dev image', type: 'warpengine', action: 'devImage' }, { label: 'play', type: 'warpengine', action: 'play' }] })

describe('TasksDocument', () => {
  it('adds the missing tasks at the end, keeping the comments and the tasks the project has', () => {
    const own = '{\n  // my tasks\n  "version": "2.0.0",\n  "tasks": [\n    { "label": "Run TIC80", "type": "shell", "command": "tic80" },\n    { "label": "play", "type": "shell", "command": "x" }\n  ]\n}\n'
    const merged: TasksMerge = new TasksDocument(own).merge(ADDITIONS)
    assert.deepEqual(merged.added, ['dev image'])
    assert.match(merged.text, /\/\/ my tasks/)
    assert.deepEqual(new TasksDocument(merged.text).labels(), ['Run TIC80', 'play', 'dev image'])
    assert.match(merged.text, /"command": "x"/)
  })

  it('takes the additions as they are when the project has no tasks.json', () => {
    const merged: TasksMerge = new TasksDocument(null).merge(ADDITIONS)
    assert.equal(merged.text, ADDITIONS)
    assert.deepEqual(merged.added, ['dev image', 'play'])
  })

  it('creates the tasks array when the document has none', () => {
    const merged: TasksMerge = new TasksDocument('{ "version": "2.0.0" }').merge(ADDITIONS)
    assert.deepEqual(new TasksDocument(merged.text).labels(), ['dev image', 'play'])
  })

  it('refuses a document that is not JSON with comments', () => {
    assert.throws(() => new TasksDocument('{ "tasks": [ ').merge(ADDITIONS), DomainError)
  })
})
