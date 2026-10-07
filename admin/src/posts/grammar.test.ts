import { describe, expect, it } from 'vitest'
import { afterApplying, buildTextMap, summary, toDocRange, toSuggestions } from './grammar'
import type { DocNode, GrammarMatch, Suggestion } from './grammar'

/** Builds a fake document: each paragraph is a list of text pieces, laid out with ProseMirror's position rules. */
function fakeDoc(paragraphs: string[][]): DocNode {
  return {
    descendants(visit) {
      let pos = 0
      for (const pieces of paragraphs) {
        const paragraph: DocNode = { descendants() {} }
        visit(paragraph, pos, null)
        pos += 1 // entering the paragraph
        for (const piece of pieces) {
          visit({ isText: true, text: piece, descendants() {} }, pos, paragraph)
          pos += piece.length
        }
        pos += 1 // leaving it
      }
    },
  }
}

const match = (offset: number, length: number, extra: Partial<GrammarMatch> = {}): GrammarMatch =>
  ({ offset, length, message: 'm', category: '', replacements: ['x'], ...extra })

describe('buildTextMap', () => {
  it('joins the text pieces of one paragraph without anything between them', () => {
    expect(buildTextMap(fakeDoc([['Hello ', 'bold', ' world']])).text).toBe('Hello bold world')
  })

  it('separates paragraphs with a blank line so no suggestion spans two', () => {
    expect(buildTextMap(fakeDoc([['One.'], ['Two.']])).text).toBe('One.\n\nTwo.')
  })

  it('is empty for a document with no text', () => {
    expect(buildTextMap(fakeDoc([[]])).text).toBe('')
  })

  it('puts a single line break where a hard break sits inside a paragraph', () => {
    const doc: DocNode = {
      descendants(visit) {
        const p: DocNode = { descendants() {} }
        visit(p, 0, null)
        visit({ isText: true, text: 'ab', descendants() {} }, 1, p)
        // a hard break takes one position (3), so the next piece starts at 4
        visit({ isText: true, text: 'cd', descendants() {} }, 4, p)
      },
    }
    expect(buildTextMap(doc).text).toBe('ab\ncd')
  })
})

describe('toDocRange', () => {
  const map = buildTextMap(fakeDoc([['Teh cat'], ['Second one']]))

  it('maps a word in the first paragraph to its place in the document', () => {
    // paragraph content starts at position 1
    expect(toDocRange(map, 0, 3)).toEqual({ from: 1, to: 4 })
  })

  it('accounts for the paragraph boundary when mapping into a later paragraph', () => {
    // "Teh cat" is 7 chars: positions 1-8, close at 8, open of next at 9, content from 10.
    // In flattened text "Second" starts at 7 + 2 = 9.
    expect(toDocRange(map, 9, 6)).toEqual({ from: 10, to: 16 })
  })

  it('refuses a range that runs past the end of a piece', () => {
    expect(toDocRange(map, 5, 6)).toBeNull()
  })

  it('refuses a range that starts in a break or outside the text', () => {
    expect(toDocRange(map, 7, 1)).toBeNull()
    expect(toDocRange(map, 500, 1)).toBeNull()
  })

  it('refuses an empty or negative range', () => {
    expect(toDocRange(map, 2, 0)).toBeNull()
    expect(toDocRange(map, -1, 2)).toBeNull()
  })

  it('maps into the second of two pieces in the same paragraph', () => {
    const pieces = buildTextMap(fakeDoc([['Hello ', 'wrold']]))
    expect(toDocRange(pieces, 6, 5)).toEqual({ from: 7, to: 12 })
  })
})

describe('toSuggestions', () => {
  it('records the words each match pointed at', () => {
    const result = toSuggestions('Teh cat', [match(0, 3)])
    expect(result).toHaveLength(1)
    expect(result[0].original).toBe('Teh')
    expect(result[0].id).toBe(0)
  })

  it('drops matches that are empty or point outside the text', () => {
    expect(toSuggestions('Teh cat', [match(0, 0), match(5, 10), match(-1, 2)])).toEqual([])
  })
})

describe('afterApplying', () => {
  const make = (id: number, offset: number, length: number): Suggestion => ({ ...match(offset, length), id, original: '' })

  it('removes the accepted suggestion', () => {
    const list = [make(0, 0, 3), make(1, 10, 2)]
    expect(afterApplying(list, list[0], 'The').map((s) => s.id)).toEqual([1])
  })

  it('moves later suggestions by how much the text grew', () => {
    const list = [make(0, 0, 3), make(1, 10, 2)]
    expect(afterApplying(list, list[0], 'There')[0].offset).toBe(12)
  })

  it('moves later suggestions back when the text shrank', () => {
    const list = [make(0, 0, 5), make(1, 10, 2)]
    expect(afterApplying(list, list[0], 'a')[0].offset).toBe(6)
  })

  it('leaves earlier suggestions where they were', () => {
    const list = [make(0, 0, 3), make(1, 10, 2)]
    expect(afterApplying(list, list[1], 'longer replacement')[0].offset).toBe(0)
  })

  it('drops a suggestion that overlapped the one accepted', () => {
    const list = [make(0, 4, 6), make(1, 8, 4), make(2, 20, 1)]
    expect(afterApplying(list, list[0], 'xx').map((s) => s.id)).toEqual([2])
  })

  it('keeps a suggestion that touches the accepted one without overlapping', () => {
    const list = [make(0, 0, 3), make(1, 3, 2)]
    expect(afterApplying(list, list[0], 'abcd')[0].offset).toBe(4)
  })
})

describe('summary', () => {
  it('says what was found in plain words', () => {
    expect(summary(0)).toBe('No problems found.')
    expect(summary(1)).toBe('1 suggestion.')
    expect(summary(4)).toBe('4 suggestions.')
  })
})
