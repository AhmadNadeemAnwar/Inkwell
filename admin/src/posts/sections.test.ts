import { describe, expect, it } from 'vitest'
import {
  EMPTY_DOC, findProblem, hasContent, isWebAddress, moveSection, newSection, parseContent, removeSection,
  serializeContent, updateSection,
} from './sections'
import type { Section } from './sections'

const IMAGE_ID = '0b6f8f0e-2f0b-4a53-9a3e-0e6a1f4f7c11'

const paragraph = (words: string) => ({ type: 'paragraph', content: [{ type: 'text', text: words }] })
const textSection = (words: string): Section => ({ key: `t-${words}`, type: 'text', doc: JSON.stringify({ type: 'doc', content: [paragraph(words)] }) })
const imageSection = (imageId: string | null = IMAGE_ID): Section => ({ key: 'img', type: 'image', imageId, alt: 'A chart', caption: 'Figure 1' })
const referencesSection = (...items: [string, string][]): Section => ({ key: 'refs', type: 'references', items: items.map(([title, url]) => ({ title, url })) })

const stored = (sections: Section[]) => JSON.parse(serializeContent(sections)) as { type: string; content: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }[] }
const keys = (sections: Section[]) => sections.map((s) => s.key)

describe('serializeContent', () => {
  it('stores each kind of section in the order the writer arranged them', () => {
    const body = stored([textSection('Opening'), imageSection(), referencesSection(['The paper', 'https://example.com/paper'])])

    expect(body.type).toBe('sections')
    expect(body.content.map((s) => s.type)).toEqual(['textSection', 'imageSection', 'referencesSection'])
    expect(body.content[0].content).toEqual([paragraph('Opening')])
    expect(body.content[1].attrs).toEqual({ imageId: IMAGE_ID, alt: 'A chart', caption: 'Figure 1' })
    expect(body.content[2].attrs).toEqual({ items: [{ title: 'The paper', url: 'https://example.com/paper' }] })
  })

  it('leaves out an image section that has no picture yet, so a half-built post still saves', () => {
    expect(stored([textSection('Body'), imageSection(null)]).content.map((s) => s.type)).toEqual(['textSection'])
  })

  it('leaves out sources with no title, and a reference section left with none', () => {
    const mixed = stored([referencesSection(['Kept', ''], ['', ''], ['   ', ''])])
    const empty = stored([textSection('Body'), referencesSection(['', ''])])

    expect(mixed.content[0].attrs).toEqual({ items: [{ title: 'Kept', url: '' }] })
    expect(empty.content.map((s) => s.type)).toEqual(['textSection'])
  })

  it('trims the spaces a writer leaves around captions, titles and links', () => {
    const body = stored([
      { key: 'i', type: 'image', imageId: IMAGE_ID, alt: '  A chart ', caption: ' Figure 1  ' },
      referencesSection(['  The paper ', ' https://example.com '])
    ])

    expect(body.content[0].attrs).toEqual({ imageId: IMAGE_ID, alt: 'A chart', caption: 'Figure 1' })
    expect(body.content[1].attrs).toEqual({ items: [{ title: 'The paper', url: 'https://example.com' }] })
  })

  it('never stores the editor-only key', () => {
    expect(serializeContent([textSection('Body'), imageSection()])).not.toContain('"key"')
  })

  it('stores an empty paragraph for a text section whose document is unreadable', () => {
    expect(stored([{ key: 'x', type: 'text', doc: 'not json' }]).content[0].content).toEqual([{ type: 'paragraph' }])
  })
})

describe('parseContent', () => {
  it('opens a post written before sections existed as a single text section', () => {
    const legacy = JSON.stringify({ type: 'doc', content: [paragraph('An older post'), paragraph('Second paragraph')] })

    const sections = parseContent(legacy)

    expect(sections).toHaveLength(1)
    expect(sections[0].type).toBe('text')
    expect(stored(sections).content[0].content).toEqual([paragraph('An older post'), paragraph('Second paragraph')])
  })

  it('reads back exactly what was stored', () => {
    const original = [textSection('Opening'), imageSection(), textSection('Closing'), referencesSection(['The paper', 'https://example.com/paper'], ['A book', ''])]

    const once = serializeContent(original)
    const twice = serializeContent(parseContent(once))

    expect(twice).toBe(once)
  })

  it('gives every section its own key', () => {
    const sections = parseContent(serializeContent([textSection('a'), textSection('b'), imageSection()]))

    expect(new Set(keys(sections)).size).toBe(3)
  })

  it.each([
    ['nothing at all', ''],
    ['text that is not JSON', 'not json'],
    ['a JSON list', '[]'],
    ['an unknown kind of body', '{"type":"mystery"}'],
    ['sections that are not a list', '{"type":"sections","content":{}}'],
    ['an empty list of sections', '{"type":"sections","content":[]}'],
  ])('falls back to one empty text section for %s', (_, json) => {
    const sections = parseContent(json)

    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ type: 'text', doc: EMPTY_DOC })
  })

  it('skips sections of a kind it does not know, keeping the rest', () => {
    const json = JSON.stringify({ type: 'sections', content: [{ type: 'scriptSection' }, 'junk', { type: 'textSection', content: [paragraph('Kept')] }] })

    expect(parseContent(json).map((s) => s.type)).toEqual(['text'])
  })

  it('treats an image id that is not a real id as no picture', () => {
    const json = JSON.stringify({ type: 'sections', content: [{ type: 'imageSection', attrs: { imageId: 'https://evil.example/x.png', alt: 7 } }] })

    expect(parseContent(json)[0]).toMatchObject({ type: 'image', imageId: null, alt: '', caption: '' })
  })
})

describe('moving and removing sections', () => {
  const sections = [textSection('a'), textSection('b'), textSection('c')]

  it('moves a section up and down by one place', () => {
    expect(keys(moveSection(sections, 't-c', -1))).toEqual(['t-a', 't-c', 't-b'])
    expect(keys(moveSection(sections, 't-a', 1))).toEqual(['t-b', 't-a', 't-c'])
  })

  it('leaves the order alone at either end, and for a key it does not know', () => {
    expect(moveSection(sections, 't-a', -1)).toBe(sections)
    expect(moveSection(sections, 't-c', 1)).toBe(sections)
    expect(moveSection(sections, 'missing', 1)).toBe(sections)
  })

  it('does not change the list it was given', () => {
    moveSection(sections, 't-b', 1)
    removeSection(sections, 't-b')

    expect(keys(sections)).toEqual(['t-a', 't-b', 't-c'])
  })

  it('removes only the section asked for', () => {
    expect(keys(removeSection(sections, 't-b'))).toEqual(['t-a', 't-c'])
  })

  it('changes only the section asked for', () => {
    const changed = updateSection(sections, 't-b', (s) => ({ ...s, doc: EMPTY_DOC } as Section))

    expect(changed[1]).toMatchObject({ doc: EMPTY_DOC })
    expect(changed[0]).toBe(sections[0])
  })
})

describe('hasContent', () => {
  it('is false for a section the writer has not put anything in', () => {
    expect(hasContent(newSection('text'))).toBe(false)
    expect(hasContent(newSection('image'))).toBe(false)
    expect(hasContent(newSection('references'))).toBe(false)
  })

  it('is true once there is writing, a picture, or a source', () => {
    expect(hasContent(textSection('words'))).toBe(true)
    expect(hasContent(imageSection())).toBe(true)
    expect(hasContent(referencesSection(['', 'https://example.com']))).toBe(true)
  })

  it('does not count a paragraph of only spaces as writing', () => {
    expect(hasContent(textSection('   '))).toBe(false)
  })
})

describe('findProblem', () => {
  it('finds nothing wrong with a finished post', () => {
    expect(findProblem([textSection('Body'), imageSection(), referencesSection(['The paper', 'https://example.com'], ['A book', ''])])).toBeNull()
  })

  it('does not complain about pieces that are simply not filled in yet', () => {
    expect(findProblem([newSection('text'), newSection('image'), newSection('references')])).toBeNull()
  })

  it('catches a source with a link but no title, which would otherwise be dropped silently', () => {
    expect(findProblem([referencesSection(['', 'https://example.com'])])).toMatch(/no title/)
  })

  it.each(['javascript:alert(1)', 'example.com/no-scheme', '//example.com', 'ftp://example.com/file'])('refuses the link %s', (url) => {
    expect(findProblem([referencesSection(['A source', url])])).toMatch(/http/)
  })

  it('catches text that is too long for its field', () => {
    expect(findProblem([{ key: 'i', type: 'image', imageId: IMAGE_ID, alt: 'x'.repeat(301), caption: '' }])).toMatch(/300/)
    expect(findProblem([referencesSection(['x'.repeat(201), ''])])).toMatch(/200/)
  })

  it('catches too many sections and too many sources', () => {
    expect(findProblem(Array.from({ length: 101 }, (_, i) => textSection(`s${i}`)))).toMatch(/100 sections/)
    expect(findProblem([referencesSection(...Array.from({ length: 51 }, (): [string, string] => ['A source', '']))])).toMatch(/50 sources/)
  })
})

describe('isWebAddress', () => {
  it.each(['https://example.com', 'http://example.com/a?b=c', '  https://example.com  '])('accepts %s', (url) => {
    expect(isWebAddress(url)).toBe(true)
  })

  it.each(['', 'example.com', 'javascript:alert(1)', 'data:text/html,x', 'mailto:me@example.com', '/relative/path'])('refuses %s', (url) => {
    expect(isWebAddress(url)).toBe(false)
  })
})
