import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { MIN_CONTRAST, contrast } from './src/lib/palette.ts'

/**
 * The three built-in themes are written by hand in index.css, so they are checked here the way custom
 * themes are checked in palette.test.ts: every piece of text readable on every surface it can sit on.
 */
const css = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

/** The custom properties in the block that opens right after `selector`. */
function theme(selector, from = 0) {
  const start = css.indexOf(selector, from)
  if (start < 0) throw new Error(`No block for ${selector}`)
  const open = css.indexOf('{', start)
  const body = css.slice(open + 1, css.indexOf('}', open))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((m) => [m[1], m[2]]))
}

const THEMES = {
  blue: theme(':root {'),
  dark: theme(':root {', css.indexOf('@media (prefers-color-scheme: dark)')),
  seagreen: theme(":root[data-theme='seagreen']"),
}

describe.each(Object.entries(THEMES))('the %s theme', (_name, t) => {
  const surfaces = [t['--bg'], t['--bg-subtle'], t['--bg-raised']]

  it('defines every colour the page uses', () => {
    for (const name of ['--bg', '--bg-subtle', '--bg-raised', '--border', '--border-strong', '--text', '--text-muted', '--text-faint', '--accent', '--accent-soft']) {
      expect(t[name], name).toBeDefined()
    }
  })

  it('keeps muted and small print readable on every surface', () => {
    for (const surface of surfaces) {
      expect(contrast(t['--text-muted'], surface), `muted on ${surface}`).toBeGreaterThanOrEqual(MIN_CONTRAST)
      expect(contrast(t['--text-faint'], surface), `faint on ${surface}`).toBeGreaterThanOrEqual(MIN_CONTRAST)
    }
  })

  it('keeps links, outline buttons and tags readable', () => {
    for (const surface of surfaces) expect(contrast(t['--accent'], surface), `accent on ${surface}`).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrast(t['--accent'], t['--accent-soft']), 'tag text on its tint').toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('leans its greys toward the accent instead of leaving them neutral', () => {
    // Blue and green accents sit apart from red, so a tinted grey has its red channel pulled away from the blue or green one.
    const spread = (hex) => Math.max(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))) - Math.min(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)))
    expect(spread(t['--border']), 'border').toBeGreaterThanOrEqual(8)
    expect(spread(t['--border-strong']), 'strong border').toBeGreaterThanOrEqual(10)
    expect(spread(t['--text-muted']), 'muted text').toBeGreaterThanOrEqual(10)
  })
})

describe('the stylesheet', () => {
  it('shows the whole site at 90% of the browser text size', () => {
    expect(css).toMatch(/html\s*\{\s*font-size:\s*90%;\s*\}/)
    expect(css).toMatch(/body\s*\{[^}]*font-size:\s*1rem;/)
  })

  it('draws tags in the theme colour rather than neutral grey', () => {
    const pill = css.match(/\.pill\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(pill).toContain('background: var(--accent-soft)')
    expect(pill).toContain('color: var(--accent)')
    expect(pill).not.toContain('--text-muted')
  })

  it('draws outline buttons in the theme colour', () => {
    const btn = css.match(/\n\.btn\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(btn).toContain('color: var(--accent)')
    expect(btn).toContain('var(--accent)')
  })
})
