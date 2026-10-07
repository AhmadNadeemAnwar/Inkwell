/**
 * Grammar checking works on plain text, but the editor holds a document. This file turns one into
 * the other and back: it flattens the document to the text that is sent for checking, remembers
 * where each piece of that text lives in the document, and turns a suggestion's offsets into
 * document positions when the writer accepts it. No React and no editor in here, so every rule
 * can be unit tested.
 */

export interface GrammarMatch {
  /** Counted in characters of the text that was sent. */
  offset: number
  length: number
  message: string
  category: string
  replacements: string[]
}

/** A suggestion as the panel holds it: the match plus the words it pointed at when it was made. */
export interface Suggestion extends GrammarMatch {
  id: number
  original: string
}

/** The part of a ProseMirror node this file needs, so tests can stand in a plain object for it. */
export interface DocNode {
  isText?: boolean
  text?: string | null
  descendants(visit: (node: DocNode, pos: number, parent: DocNode | null) => boolean | void): void
}

interface Segment {
  /** Where this piece starts in the flattened text. */
  textStart: number
  /** Where it starts in the document. */
  docStart: number
  length: number
}

export interface TextMap {
  text: string
  segments: Segment[]
}

/** The free service refuses more than this in one go; the API enforces the same figure. */
export const MAX_CHECK_CHARACTERS = 15_000

/** Paragraphs are told apart in the flattened text, so a mistake is never read across two of them. */
const BLOCK_BREAK = '\n\n'
const LINE_BREAK = '\n'

export function buildTextMap(doc: DocNode): TextMap {
  const segments: Segment[] = []
  let text = ''
  let previousEnd = -1
  let previousParent: DocNode | null = null

  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return true

    if (segments.length > 0 && !(pos === previousEnd && parent === previousParent)) {
      text += parent === previousParent ? LINE_BREAK : BLOCK_BREAK
    }

    segments.push({ textStart: text.length, docStart: pos, length: node.text.length })
    text += node.text
    previousEnd = pos + node.text.length
    previousParent = parent
    return true
  })

  return { text, segments }
}

/** Where a suggestion sits in the document, or null if it runs across a break or a gap the editor cannot replace in one step. */
export function toDocRange(map: TextMap, offset: number, length: number): { from: number; to: number } | null {
  if (length <= 0 || offset < 0) return null

  const segment = map.segments.find((s) => offset >= s.textStart && offset < s.textStart + s.length)
  if (!segment) return null
  if (offset + length > segment.textStart + segment.length) return null

  const from = segment.docStart + (offset - segment.textStart)
  return { from, to: from + length }
}

/** Keeps the useful matches and records what each one pointed at, so a later edit can be noticed. */
export function toSuggestions(text: string, matches: GrammarMatch[]): Suggestion[] {
  return matches
    .filter((m) => m.length > 0 && m.offset >= 0 && m.offset + m.length <= text.length)
    .map((m, id) => ({ ...m, id, original: text.slice(m.offset, m.offset + m.length) }))
}

/**
 * After a suggestion is accepted the text around it moves. The accepted one goes, anything that
 * overlapped it goes with it (it no longer describes real text), and everything after it slides
 * by the change in length.
 */
export function afterApplying(suggestions: Suggestion[], applied: Suggestion, replacement: string): Suggestion[] {
  const delta = replacement.length - applied.length
  const appliedEnd = applied.offset + applied.length

  return suggestions
    .filter((s) => s.id !== applied.id && !(s.offset < appliedEnd && s.offset + s.length > applied.offset))
    .map((s) => (s.offset >= appliedEnd ? { ...s, offset: s.offset + delta } : s))
}

/** A short line saying how many things were found. */
export function summary(count: number): string {
  if (count === 0) return 'No problems found.'
  return count === 1 ? '1 suggestion.' : `${count} suggestions.`
}
