
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SparkleIcon } from './SparkleIcon'

describe('SparkleIcon', () => {
  const html = renderToStaticMarkup(<SparkleIcon />)

  it('is decorative: hidden from screen readers, because the button text names the action', () => {
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('focusable="false"')
  })

  it('is two stars drawn in the text colour, so it follows the button in every theme', () => {
    expect(html.match(/<path/g)).toHaveLength(2)
    expect(html.match(/fill="currentColor"/g)).toHaveLength(2)
    expect(html).toContain('class="btn__icon"')
  })
})
