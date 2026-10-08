import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('the admin stylesheet', () => {
  it('shows the whole portal at 90% of the browser text size', () => {
    expect(css).toMatch(/html\s*\{\s*font-size:\s*90%;\s*\}/)
  })

  it('sizes the sparkle icon with the button text', () => {
    expect(css).toMatch(/\.btn__icon\s*\{[^}]*width:\s*1\.05em/)
  })
})
