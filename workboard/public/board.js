// Reading and rewriting WORKBOARD.md. This file has no browser or Node code in it, so the same
// rules run in the page and in the tests.
//
// The file stays an ordinary Markdown file that is pleasant to read and edit by hand, and that
// Claude reads directly. So this never "regenerates" it: the file is split into blocks, only the
// block being changed is touched, and everything else is written back exactly as it was found.

export const STATUSES = [
  { mark: ' ', id: 'todo', label: 'Not started' },
  { mark: '~', id: 'doing', label: 'In progress' },
  { mark: 'x', id: 'done', label: 'Done' },
  { mark: '-', id: 'dropped', label: 'Not doing' },
]

const BY_MARK = new Map(STATUSES.map((s) => [s.mark, s.id]))
const BY_ID = new Map(STATUSES.map((s) => [s.id, s.mark]))

const ITEM = /^- \[( |~|x|X|-)\](?: (.*))?$/
const HEADING = /^## (.+?)\s*$/
const URGENT = /\s*\(urgent\)\s*$/i

export const MAX_ITEM_LENGTH = 600

/** A status counts as finished when nothing more is expected to happen to the item. */
export const isFinished = (status) => status === 'done' || status === 'dropped'

/**
 * Splits the file into blocks: a heading, an item (with the indented notes under it), or a run of
 * any other lines. `eol` and the trailing newline are remembered so the file can be written back
 * byte for byte.
 */
export function parse(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const body = text.replace(/\r\n/g, '\n')
  const endsWithNewline = body.endsWith('\n')
  const lines = (endsWithNewline ? body.slice(0, -1) : body).split('\n')

  const blocks = []
  let section = null
  let nextId = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const heading = HEADING.exec(line)
    if (heading) {
      section = sectionOf(heading[1])
      blocks.push({ type: 'heading', line, section })
      continue
    }

    const item = ITEM.exec(line)
    if (item) {
      const notes = []
      // Notes are the indented lines directly under an item. A blank line ends them.
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) notes.push(lines[++i])
      blocks.push({
        type: 'item',
        id: `i${nextId++}`,
        status: BY_MARK.get(item[1].toLowerCase()),
        text: item[2] ?? '',
        notes,
        section: section?.id ?? null,
      })
      continue
    }

    const last = blocks[blocks.length - 1]
    if (last && last.type === 'text') last.lines.push(line)
    else blocks.push({ type: 'text', lines: [line], section: section?.id ?? null })
  }

  return { blocks, eol, endsWithNewline }
}

/** "2. Things to do" → { id: '2', title: 'Things to do' }. A heading without a number keeps its text as its id. */
function sectionOf(heading) {
  const numbered = /^(\d+)\.\s*(.+)$/.exec(heading)
  return numbered ? { id: numbered[1], title: numbered[2] } : { id: heading, title: heading }
}

export function serialize(doc) {
  const lines = []
  for (const block of doc.blocks) {
    if (block.type === 'heading') lines.push(block.line)
    else if (block.type === 'text') lines.push(...block.lines)
    else lines.push(itemLine(block), ...block.notes)
  }
  return lines.join(doc.eol) + (doc.endsWithNewline ? doc.eol : '')
}

const itemLine = (item) => (item.text === '' ? `- [${BY_ID.get(item.status)}]` : `- [${BY_ID.get(item.status)}] ${item.text}`)

/** One line, trimmed, with the characters that would break the list removed. */
export function cleanText(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LENGTH)
}

export const isUrgent = (text) => URGENT.test(text)

export function setUrgent(text, urgent) {
  const base = text.replace(URGENT, '')
  return urgent ? `${base} (urgent)` : base
}

/** The sections in file order, each with its title and its items, for drawing the board. */
export function sections(doc) {
  const result = []
  let current = null
  for (const block of doc.blocks) {
    if (block.type === 'heading') {
      current = { id: block.section.id, title: block.section.title, items: [] }
      result.push(current)
    } else if (block.type === 'item' && current) {
      // An empty "- [ ]" is the placeholder the file starts with, not something to do.
      if (block.text !== '') current.items.push(block)
    }
  }
  return result
}

const clone = (doc) => ({ ...doc, blocks: doc.blocks.map((b) => (b.type === 'item' ? { ...b, notes: [...b.notes] } : b.type === 'text' ? { ...b, lines: [...b.lines] } : b)) })

const indexOfItem = (doc, id) => doc.blocks.findIndex((b) => b.type === 'item' && b.id === id)

function freshId(doc) {
  const used = doc.blocks.filter((b) => b.type === 'item').map((b) => Number(b.id.slice(1)))
  return `i${Math.max(0, ...used) + 1}`
}

/**
 * Adds an item to a section and returns the new document, or null if the section is not in the
 * file. It goes after the section's last item, or into the empty placeholder if there is one.
 */
export function addItem(doc, sectionId, text) {
  const clean = cleanText(text)
  if (clean === '') return null

  const next = clone(doc)
  const start = next.blocks.findIndex((b) => b.type === 'heading' && b.section.id === sectionId)
  if (start < 0) return null

  let end = next.blocks.findIndex((b, i) => i > start && b.type === 'heading')
  if (end < 0) end = next.blocks.length

  const placeholder = next.blocks.findIndex((b, i) => i > start && i < end && b.type === 'item' && b.text === '')
  if (placeholder >= 0) {
    next.blocks[placeholder] = { ...next.blocks[placeholder], text: clean, status: 'todo' }
    return next
  }

  let lastItem = -1
  for (let i = start + 1; i < end; i++) if (next.blocks[i].type === 'item') lastItem = i

  const item = { type: 'item', id: freshId(next), status: 'todo', text: clean, notes: [], section: sectionId }
  if (lastItem >= 0) {
    next.blocks.splice(lastItem + 1, 0, item)
    return next
  }

  // A section with no list yet: put the item before the trailing blank lines and the "---" rule.
  const tail = next.blocks[end - 1]
  if (tail && tail.type === 'text' && end - 1 > start) {
    const lines = [...tail.lines]
    let cut = lines.length
    while (cut > 0 && (lines[cut - 1].trim() === '' || lines[cut - 1].trim() === '---')) cut--
    const before = lines.slice(0, cut)
    const after = lines.slice(cut)
    const replacement = []
    if (before.length > 0) replacement.push({ type: 'text', lines: [...before, ''], section: sectionId })
    replacement.push(item)
    if (after.length > 0) replacement.push({ type: 'text', lines: after, section: sectionId })
    next.blocks.splice(end - 1, 1, ...replacement)
    return next
  }

  next.blocks.splice(end, 0, { type: 'text', lines: [''], section: sectionId }, item)
  return next
}

/** Changes an item's wording and/or status. Returns the new document, or null if there is no such item. */
export function updateItem(doc, id, change) {
  const index = indexOfItem(doc, id)
  if (index < 0) return null

  const next = clone(doc)
  const item = next.blocks[index]

  if (change.text !== undefined) {
    const clean = cleanText(change.text)
    if (clean === '') return null
    item.text = clean
  }
  if (change.status !== undefined) {
    if (!BY_ID.has(change.status)) return null
    item.status = change.status
  }
  return next
}

/**
 * Moves an item one place up (-1) or down (+1) among its neighbours, taking its notes with it.
 * It only swaps with an item directly next to it, so it can never jump a heading or a paragraph
 * into another group. Returns the same document when it cannot move.
 */
export function moveItem(doc, id, direction) {
  const index = indexOfItem(doc, id)
  const other = index + direction
  if (index < 0 || other < 0 || other >= doc.blocks.length) return doc
  if (doc.blocks[other].type !== 'item' || doc.blocks[other].text === '') return doc

  const next = clone(doc)
  ;[next.blocks[index], next.blocks[other]] = [next.blocks[other], next.blocks[index]]
  return next
}

/** Whether an item has an item directly above or below it to swap with. */
export function canMove(doc, id, direction) {
  const index = indexOfItem(doc, id)
  const other = doc.blocks[index + direction]
  return index >= 0 && other !== undefined && other.type === 'item' && other.text !== ''
}

/**
 * The board hides finished items in a folded group, so "up" and "down" there mean past the next
 * item still open, stepping over any finished ones between. This finds that item's place, or -1
 * when a heading, a paragraph or the end of the list comes first.
 */
function openNeighbour(doc, index, direction) {
  let other = index + direction
  const isItem = (b) => b !== undefined && b.type === 'item' && b.text !== ''
  while (isItem(doc.blocks[other]) && isFinished(doc.blocks[other].status)) other += direction
  return isItem(doc.blocks[other]) ? other : -1
}

export function canMoveOpen(doc, id, direction) {
  const index = indexOfItem(doc, id)
  return index >= 0 && openNeighbour(doc, index, direction) >= 0
}

/** Moves an item past the next open item above (-1) or below (+1). Returns the same document when it cannot. */
export function moveOpenItem(doc, id, direction) {
  const index = indexOfItem(doc, id)
  if (index < 0) return doc
  const other = openNeighbour(doc, index, direction)
  if (other < 0) return doc

  const next = clone(doc)
  const [item] = next.blocks.splice(index, 1)
  next.blocks.splice(other, 0, item)
  return next
}

/** A note line as written ("  - *Plan: …*") without its indentation and bullet. */
export function noteText(line) {
  return line.replace(/^\s+(?:[-*]\s+)?/, '')
}

/**
 * Splits a line into plain, bold, italic and code pieces so the page can show light formatting
 * without ever treating the file's text as HTML. Anything it does not recognise stays plain.
 */
export function inline(text) {
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ kind: 'text', value: text.slice(last, match.index) })
    const token = match[0]
    if (token.startsWith('**')) parts.push({ kind: 'bold', value: token.slice(2, -2) })
    else if (token.startsWith('`')) parts.push({ kind: 'code', value: token.slice(1, -1) })
    else parts.push({ kind: 'italic', value: token.slice(1, -1) })
    last = match.index + token.length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}
