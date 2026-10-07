import { describe, expect, it } from 'vitest'
import { MIN_CONTRAST, MIN_TEXT_CONTRAST, backgroundProblem, contrast, mix, paletteFrom, toColors, toHex } from './palette'

describe('toHex', () => {
  it('accepts a plain six-digit colour, whatever its capitals or spacing', () => {
    expect(toHex('#17694a')).toBe('#17694a')
    expect(toHex(' #17694A ')).toBe('#17694a')
  })

  it.each([undefined, null, 42, '', 'green', '#fff', '#17694', '#17694ag', '17694a', '#17694a; background: url(x)', 'rgb(1,2,3)', '#17694a80'])(
    'refuses %s', (value) => {
      expect(toHex(value)).toBeNull()
    })
})

describe('contrast and mix', () => {
  it('measures contrast the standard way, in either order', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 3)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
    expect(contrast('#ffffff', '#777777')).toBeCloseTo(4.48, 1)
  })

  it('mixes two colours by an amount', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mix('#ff0000', '#0000ff', 0.25)).toBe('#bf0040')
  })
})

describe('backgroundProblem', () => {
  it.each(['#ffffff', '#fff8f0', '#f2f2f1', '#e8f0ff', '#101418', '#000000', '#1b1030'])('allows %s', (background) => {
    expect(backgroundProblem(background)).toBeNull()
  })

  it.each(['#808080', '#7a7a7a', '#c0392b', '#2e86de', '#27ae60'])('refuses the mid-tone %s', (background) => {
    expect(backgroundProblem(background)).toMatch(/lighter or a darker/)
  })
})

describe('toColors', () => {
  it('accepts two usable colours and tidies them', () => {
    expect(toColors({ main: '#7A1F5C', background: ' #FFF8F0 ' })).toEqual({ main: '#7a1f5c', background: '#fff8f0' })
  })

  it.each([
    null, undefined, 'custom', 42, [], {},
    { main: '#7a1f5c' },
    { main: 'red', background: '#ffffff' },
    { main: '#7a1f5c', background: '#808080' },
    { main: '#7a1f5c', background: '#fff;}body{display:none' },
  ])('refuses %j', (value) => {
    expect(toColors(value)).toBeNull()
  })
})

// A spread of main colours (pale, vivid, mid, dark, grey, the extremes) against light and dark pages.
const MAINS = ['#17694a', '#185fa5', '#7a1f5c', '#ffd400', '#ff5a36', '#00e0ff', '#808080', '#000000', '#ffffff', '#f6f6f6', '#0b0c0e', '#8e44ad']
const BACKGROUNDS = ['#ffffff', '#fff8f0', '#f2f2f1', '#e9f2ff', '#101418', '#000000', '#1b1030', '#0e1f18']
const PAIRS = MAINS.flatMap((main) => BACKGROUNDS.map((background) => ({ main, background })))

describe('paletteFrom', () => {
  it('uses the two colours as chosen for the page and the header', () => {
    const palette = paletteFrom({ main: '#7a1f5c', background: '#fff8f0' })

    expect(palette['--bg']).toBe('#fff8f0')
    expect(palette['--chrome']).toBe('#7a1f5c')
    expect(palette['--accent']).toBe('#7a1f5c')
  })

  it('makes a light page with dark text, or a dark page with light text', () => {
    expect(paletteFrom({ main: '#17694a', background: '#ffffff' })).toMatchObject({ 'color-scheme': 'light', '--text': '#1c1e21' })
    expect(paletteFrom({ main: '#17694a', background: '#101418' })).toMatchObject({ 'color-scheme': 'dark', '--text': '#ececee' })
  })

  it('sets every colour the stylesheet uses, each as a plain colour', () => {
    const palette = paletteFrom({ main: '#17694a', background: '#ffffff' })

    expect(Object.keys(palette).sort()).toEqual([
      '--accent', '--accent-chrome', '--accent-hover', '--accent-soft', '--bg', '--bg-raised', '--bg-subtle', '--border', '--border-strong',
      '--chrome', '--chrome-border', '--chrome-muted', '--chrome-raised', '--chrome-text', '--danger', '--shadow', '--text', '--text-faint',
      '--text-muted', 'color-scheme',
    ])
    for (const [name, value] of Object.entries(palette)) {
      if (name !== '--shadow' && name !== 'color-scheme') expect(value, name).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it.each(PAIRS)('keeps everything readable for $main on $background', (colors) => {
    const p = paletteFrom(colors)
    const surfaces = [p['--bg'], p['--bg-raised'], p['--bg-subtle']]

    for (const surface of surfaces) {
      expect(contrast(p['--text'], surface), 'body text').toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST - 0.75)
      for (const name of ['--text-muted', '--text-faint', '--accent', '--accent-hover', '--danger']) {
        expect(contrast(p[name], surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(MIN_CONTRAST)
      }
    }
    // A primary button is page-coloured text on the accent; an active button is the accent on its own tint.
    expect(contrast(p['--bg'], p['--accent']), 'button text').toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrast(p['--bg'], p['--accent-hover']), 'hovered button text').toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrast(p['--accent'], p['--accent-soft']), 'active button').toBeGreaterThanOrEqual(MIN_CONTRAST)

    for (const surface of [p['--chrome'], p['--chrome-raised']]) {
      for (const name of ['--chrome-text', '--chrome-muted', '--accent-chrome']) {
        expect(contrast(p[name], surface), `${name} on the header`).toBeGreaterThanOrEqual(MIN_CONTRAST)
      }
    }
  })

  it('shifts a main colour that could not be read on the page, and leaves the header as chosen', () => {
    const palette = paletteFrom({ main: '#ffd400', background: '#ffffff' })

    expect(palette['--chrome']).toBe('#ffd400')
    expect(palette['--accent']).not.toBe('#ffd400')
    expect(palette['--chrome-text']).toBe('#000000')
  })
})
