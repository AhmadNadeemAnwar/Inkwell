import { describe, expect, it } from 'vitest'
import { applyTheme, rememberedTheme, toTheme } from './theme'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

const broken = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
}

const root = () => ({ dataset: {} as Record<string, string | undefined> })

describe('toTheme', () => {
  it('accepts the themes the site has', () => {
    expect(toTheme('blue')).toBe('blue')
    expect(toTheme('seagreen')).toBe('seagreen')
  })

  it.each([undefined, null, '', 'neon', 'SeaGreen', 42, 'seagreen"; background:url(x)'])('falls back to the default for %s', (value) => {
    expect(toTheme(value)).toBe('blue')
  })
})

describe('applyTheme', () => {
  it('marks the page with a theme that is not the default, and remembers it', () => {
    const page = root()
    const storage = fakeStorage()

    expect(applyTheme('seagreen', page, storage)).toBe('seagreen')

    expect(page.dataset.theme).toBe('seagreen')
    expect(storage.data.get('inkwell.theme')).toBe('seagreen')
  })

  it('clears the mark when the owner switches back to the default', () => {
    const page = root()
    const storage = fakeStorage()
    applyTheme('seagreen', page, storage)

    applyTheme('blue', page, storage)

    expect('theme' in page.dataset).toBe(false)
    expect(storage.data.get('inkwell.theme')).toBe('blue')
  })

  it('never puts an unknown value on the page', () => {
    const page = root()

    applyTheme('neon', page, fakeStorage())

    expect('theme' in page.dataset).toBe(false)
  })

  it('still themes the page when storage is blocked or missing', () => {
    const page = root()

    expect(applyTheme('seagreen', page, broken)).toBe('seagreen')
    expect(applyTheme('seagreen', page, null)).toBe('seagreen')
    expect(page.dataset.theme).toBe('seagreen')
  })
})

describe('rememberedTheme', () => {
  it('returns what was last applied in this browser', () => {
    const storage = fakeStorage()
    applyTheme('seagreen', root(), storage)

    expect(rememberedTheme(storage)).toBe('seagreen')
  })

  it('is the default for a first visit, a tampered value, or blocked storage', () => {
    expect(rememberedTheme(fakeStorage())).toBe('blue')
    expect(rememberedTheme(fakeStorage({ 'inkwell.theme': '<script>' }))).toBe('blue')
    expect(rememberedTheme(broken)).toBe('blue')
    expect(rememberedTheme(null)).toBe('blue')
  })
})
