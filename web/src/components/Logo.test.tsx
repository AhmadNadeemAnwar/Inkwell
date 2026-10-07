import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo'

describe('Logo', () => {
  it('is announced as Inkwell, once, to a screen reader', () => {
    const out = renderToStaticMarkup(<Logo />)

    expect(out).toContain('role="img"')
    expect(out).toContain('aria-label="Inkwell"')
  })

  it('carries the logo class, plus any the caller adds', () => {
    expect(renderToStaticMarkup(<Logo />)).toContain('class="logo"')
    expect(renderToStaticMarkup(<Logo className="big" />)).toContain('class="logo big"')
  })
})
