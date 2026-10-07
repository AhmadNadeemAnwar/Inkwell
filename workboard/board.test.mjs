import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  MAX_ITEM_LENGTH, addItem, canMove, canMoveOpen, cleanText, inline, isFinished, isUrgent, moveItem, moveOpenItem, noteText, parse, sections, serialize,
  setUrgent, updateItem,
} from './public/board.js'

const SAMPLE = `# Workboard

Intro text that must survive.

| Mark | Meaning |
|---|---|
| \`- [ ]\` | Not started |

---

## 1. Requirements

Rules Claude follows.

- [x] Plan the task first.
  - *Standing rule since 6 Oct.*
- [ ] Tests go with the code.

---

## 2. Things to do

Example: \`- [ ] Add a link.\`

- [~] Build the editor (urgent)
  - *Plan: sections.*
  - *Waiting on you.*
- [ ] Add categories
- [-] A change-password screen
  - *Not built, by your choice.*

---

## 3. Ideas and suggestions box

- [ ]

---

## 4. Already known and open

Claude can build these:

- [ ] Page titles
- [ ] A sitemap

These need you:

- [ ] Connect the domain

---

## 5. Log

- 6 Oct 2026: Workboard created.
`

const item = (doc, text) => doc.blocks.find((b) => b.type === 'item' && b.text === text)
const texts = (doc, sectionId) => sections(doc).find((s) => s.id === sectionId).items.map((i) => i.text)

describe('parse and serialize', () => {
  it('writes the file back exactly as it was read', () => {
    assert.equal(serialize(parse(SAMPLE)), SAMPLE)
  })

  it('keeps Windows line endings', () => {
    const windows = SAMPLE.replace(/\n/g, '\r\n')

    assert.equal(serialize(parse(windows)), windows)
  })

  it('keeps a file that does not end in a newline that way', () => {
    const trimmed = SAMPLE.trimEnd()

    assert.equal(serialize(parse(trimmed)), trimmed)
  })

  it('writes the real workboard back exactly, if it is here', () => {
    const real = join(dirname(fileURLToPath(import.meta.url)), '..', 'WORKBOARD.md')
    if (!existsSync(real)) return
    const content = readFileSync(real, 'utf8')

    assert.equal(serialize(parse(content)), content)
  })

  it('finds the sections in order with their titles', () => {
    assert.deepEqual(sections(parse(SAMPLE)).map((s) => [s.id, s.title]), [
      ['1', 'Requirements'], ['2', 'Things to do'], ['3', 'Ideas and suggestions box'], ['4', 'Already known and open'], ['5', 'Log'],
    ])
  })

  it('reads each item with its status and the notes under it', () => {
    const doc = parse(SAMPLE)

    assert.deepEqual(sections(doc)[1].items.map((i) => [i.status, i.text, i.notes.length]), [
      ['doing', 'Build the editor (urgent)', 2],
      ['todo', 'Add categories', 0],
      ['dropped', 'A change-password screen', 1],
    ])
    assert.equal(item(doc, 'Plan the task first.').status, 'done')
  })

  it('does not show the empty placeholder as something to do', () => {
    assert.deepEqual(texts(parse(SAMPLE), '3'), [])
  })

  it('does not mistake an example inside a paragraph, or a table row, for an item', () => {
    const all = parse(SAMPLE).blocks.filter((b) => b.type === 'item').map((b) => b.text)

    assert.ok(!all.some((t) => t.includes('Add a link')))
    assert.ok(!all.some((t) => t.includes('Not started')))
  })

  it('treats log lines as text, not items', () => {
    assert.deepEqual(texts(parse(SAMPLE), '5'), [])
  })

  it('reads a capital X as done', () => {
    assert.equal(parse('## 1. A\n\n- [X] Shouted\n').blocks.find((b) => b.type === 'item').status, 'done')
  })
})

describe('addItem', () => {
  it('adds after the last item of the section and touches nothing else', () => {
    const next = addItem(parse(SAMPLE), '2', 'Email subscribe')

    assert.deepEqual(texts(next, '2'), ['Build the editor (urgent)', 'Add categories', 'A change-password screen', 'Email subscribe'])
    assert.equal(serialize(next), SAMPLE.replace('  - *Not built, by your choice.*\n', '  - *Not built, by your choice.*\n- [ ] Email subscribe\n'))
  })

  it('fills the empty placeholder instead of leaving it behind', () => {
    const next = addItem(parse(SAMPLE), '3', 'Dark mode toggle?')

    assert.equal(serialize(next), SAMPLE.replace('## 3. Ideas and suggestions box\n\n- [ ]\n', '## 3. Ideas and suggestions box\n\n- [ ] Dark mode toggle?\n'))
  })

  it('adds to a section that has no list at all, before its dividing rule', () => {
    const bare = '## 1. Requirements\n\nSome intro.\n\n---\n\n## 2. Things to do\n\n- [ ] Existing\n'

    const next = addItem(parse(bare), '1', 'First rule')

    assert.equal(serialize(next), '## 1. Requirements\n\nSome intro.\n\n- [ ] First rule\n\n---\n\n## 2. Things to do\n\n- [ ] Existing\n')
  })

  it('adds to the last section of a file', () => {
    const next = addItem(parse('## 1. Only\n\n- [ ] One\n'), '1', 'Two')

    assert.equal(serialize(next), '## 1. Only\n\n- [ ] One\n- [ ] Two\n')
  })

  it('starts a new item as not started', () => {
    assert.equal(item(addItem(parse(SAMPLE), '2', 'New'), 'New').status, 'todo')
  })

  it('refuses an empty item and a section that is not in the file', () => {
    assert.equal(addItem(parse(SAMPLE), '2', '   '), null)
    assert.equal(addItem(parse(SAMPLE), '9', 'Nowhere'), null)
  })

  it('does not change the document it was given', () => {
    const doc = parse(SAMPLE)
    addItem(doc, '2', 'New')

    assert.equal(serialize(doc), SAMPLE)
  })

  it('gives the new item an id no other item has', () => {
    const next = addItem(parse(SAMPLE), '2', 'New')
    const ids = next.blocks.filter((b) => b.type === 'item').map((b) => b.id)

    assert.equal(new Set(ids).size, ids.length)
  })
})

describe('updateItem', () => {
  it('marks an item done and leaves its notes and everything else alone', () => {
    const doc = parse(SAMPLE)

    const next = updateItem(doc, item(doc, 'Build the editor (urgent)').id, { status: 'done' })

    assert.equal(serialize(next), SAMPLE.replace('- [~] Build the editor (urgent)', '- [x] Build the editor (urgent)'))
  })

  it('writes each status with its own mark', () => {
    const doc = parse(SAMPLE)
    const id = item(doc, 'Add categories').id
    const line = (status) => serialize(updateItem(doc, id, { status })).split('\n').find((l) => l.includes('Add categories'))

    assert.equal(line('todo'), '- [ ] Add categories')
    assert.equal(line('doing'), '- [~] Add categories')
    assert.equal(line('done'), '- [x] Add categories')
    assert.equal(line('dropped'), '- [-] Add categories')
  })

  it('changes the wording and keeps the notes attached', () => {
    const doc = parse(SAMPLE)

    const next = updateItem(doc, item(doc, 'Build the editor (urgent)').id, { text: 'Build the section editor' })

    assert.equal(serialize(next), SAMPLE.replace('Build the editor (urgent)', 'Build the section editor'))
    assert.equal(item(next, 'Build the section editor').notes.length, 2)
  })

  it('refuses an unknown status, blank wording, and an item that is not there', () => {
    const doc = parse(SAMPLE)
    const id = item(doc, 'Add categories').id

    assert.equal(updateItem(doc, id, { status: 'maybe' }), null)
    assert.equal(updateItem(doc, id, { text: '  ' }), null)
    assert.equal(updateItem(doc, 'i999', { status: 'done' }), null)
  })

  it('does not change the document it was given', () => {
    const doc = parse(SAMPLE)
    updateItem(doc, item(doc, 'Add categories').id, { status: 'done', text: 'Changed' })

    assert.equal(serialize(doc), SAMPLE)
  })
})

describe('moveItem', () => {
  it('moves an item up, taking its notes with it', () => {
    const doc = parse(SAMPLE)

    const next = moveItem(doc, item(doc, 'A change-password screen').id, -1)

    assert.deepEqual(texts(next, '2'), ['Build the editor (urgent)', 'A change-password screen', 'Add categories'])
    assert.ok(serialize(next).includes('- [-] A change-password screen\n  - *Not built, by your choice.*\n- [ ] Add categories\n'))
  })

  it('moves an item down past another and its notes', () => {
    const doc = parse(SAMPLE)

    const next = moveItem(doc, item(doc, 'Build the editor (urgent)').id, 1)

    assert.ok(serialize(next).includes('- [ ] Add categories\n- [~] Build the editor (urgent)\n  - *Plan: sections.*\n  - *Waiting on you.*\n- [-] A change-password screen\n'))
  })

  it('will not carry an item past a paragraph or heading into another group', () => {
    const doc = parse(SAMPLE)
    const sitemap = item(doc, 'A sitemap').id
    const titles = item(doc, 'Page titles').id

    assert.equal(moveItem(doc, sitemap, 1), doc)
    assert.equal(moveItem(doc, titles, -1), doc)
    assert.equal(canMove(doc, sitemap, 1), false)
    assert.equal(canMove(doc, sitemap, -1), true)
  })

  it('stays put at the top and bottom of a section', () => {
    const doc = parse(SAMPLE)

    assert.equal(moveItem(doc, item(doc, 'Build the editor (urgent)').id, -1), doc)
    assert.equal(moveItem(doc, item(doc, 'A change-password screen').id, 1), doc)
  })

  it('keeps every line of the file, only in a different order', () => {
    const doc = parse(SAMPLE)

    const next = moveItem(doc, item(doc, 'Add categories').id, -1)

    assert.deepEqual(serialize(next).split('\n').sort(), SAMPLE.split('\n').sort())
  })
})

describe('moveOpenItem', () => {
  const LIST = '## 2. Things to do\n\n- [ ] One\n- [x] Finished A\n  - *Note A.*\n- [-] Finished B\n- [ ] Two\n- [ ] Three\n\nA paragraph.\n\n- [ ] Other group\n'
  const order = (doc) => doc.blocks.filter((b) => b.type === 'item').map((b) => b.text)

  it('steps over finished items, which the board keeps folded away', () => {
    const doc = parse(LIST)

    const down = moveOpenItem(doc, item(doc, 'One').id, 1)
    const up = moveOpenItem(doc, item(doc, 'Two').id, -1)

    assert.deepEqual(order(down), ['Finished A', 'Finished B', 'Two', 'One', 'Three', 'Other group'])
    assert.deepEqual(order(up), ['Two', 'One', 'Finished A', 'Finished B', 'Three', 'Other group'])
    assert.ok(serialize(down).includes('- [x] Finished A\n  - *Note A.*\n- [-] Finished B\n- [ ] Two\n- [ ] One\n'))
  })

  it('stops at a paragraph and at the ends of the list', () => {
    const doc = parse(LIST)

    assert.equal(moveOpenItem(doc, item(doc, 'Three').id, 1), doc)
    assert.equal(moveOpenItem(doc, item(doc, 'One').id, -1), doc)
    assert.equal(moveOpenItem(doc, item(doc, 'Other group').id, -1), doc)
    assert.equal(moveOpenItem(doc, 'i999', 1), doc)
    assert.deepEqual([canMoveOpen(doc, item(doc, 'Three').id, 1), canMoveOpen(doc, item(doc, 'Three').id, -1)], [false, true])
  })

  it('does not move when only finished items lie in that direction', () => {
    const doc = parse('## 1. A\n\n- [ ] Open\n- [x] Done\n')

    assert.equal(canMoveOpen(doc, item(doc, 'Open').id, 1), false)
    assert.equal(moveOpenItem(doc, item(doc, 'Open').id, 1), doc)
  })

  it('keeps every line of the file', () => {
    const doc = parse(LIST)

    assert.deepEqual(serialize(moveOpenItem(doc, item(doc, 'One').id, 1)).split('\n').sort(), LIST.split('\n').sort())
  })
})

describe('text helpers', () => {
  it('makes pasted text a single tidy line', () => {
    assert.equal(cleanText('  Two\n lines\r\nand   spaces  '), 'Two lines and spaces')
    assert.equal(cleanText(null), '')
  })

  it('cuts an absurdly long item rather than writing it all', () => {
    assert.equal(cleanText('x'.repeat(MAX_ITEM_LENGTH + 50)).length, MAX_ITEM_LENGTH)
  })

  it('cannot be used to start a second list item or a heading on a new line', () => {
    const next = addItem(parse(SAMPLE), '2', 'Innocent\n- [x] Smuggled\n## 9. Fake')

    assert.equal(sections(next).length, 5)
    assert.equal(sections(next)[1].items.length, 4)
  })

  it('reads and toggles the urgent tag without doubling it', () => {
    assert.equal(isUrgent('Fix login (urgent)'), true)
    assert.equal(isUrgent('Fix login (URGENT) '), true)
    assert.equal(isUrgent('Fix the urgent thing'), false)
    assert.equal(setUrgent('Fix login', true), 'Fix login (urgent)')
    assert.equal(setUrgent('Fix login (urgent)', true), 'Fix login (urgent)')
    assert.equal(setUrgent('Fix login (urgent)', false), 'Fix login')
  })

  it('knows which statuses mean finished', () => {
    assert.deepEqual(['todo', 'doing', 'done', 'dropped'].map(isFinished), [false, false, true, true])
  })

  it('strips the bullet and indentation from a note', () => {
    assert.equal(noteText('  - *Plan: sections.*'), '*Plan: sections.*')
    assert.equal(noteText('    continued line'), 'continued line')
  })

  it('splits light formatting into pieces and leaves the rest plain', () => {
    assert.deepEqual(inline('Use **bold**, `code` and *italics* here'), [
      { kind: 'text', value: 'Use ' }, { kind: 'bold', value: 'bold' }, { kind: 'text', value: ', ' },
      { kind: 'code', value: 'code' }, { kind: 'text', value: ' and ' }, { kind: 'italic', value: 'italics' }, { kind: 'text', value: ' here' },
    ])
    assert.deepEqual(inline('2 * 3 * 4 and <b>tags</b>'), [{ kind: 'text', value: '2 * 3 * 4 and <b>tags</b>' }])
    assert.deepEqual(inline(''), [])
  })
})
