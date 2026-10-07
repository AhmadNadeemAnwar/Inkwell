import { describe, expect, it } from 'vitest'
import { MAX_CAPTION } from './sections'
import { MAX_PROMPT, altFromPrompt, base64ToFile, previewSrc, promptProblem, remainingText } from './generate'

describe('promptProblem', () => {
  it('accepts a normal description', () => {
    expect(promptProblem('a lighthouse at dusk')).toBeNull()
  })

  it('asks for more when it is empty, blank or too short', () => {
    expect(promptProblem('')).not.toBeNull()
    expect(promptProblem('    ')).not.toBeNull()
    expect(promptProblem('ab')).not.toBeNull()
  })

  it('ignores spaces around the words when counting', () => {
    expect(promptProblem('  ab  ')).not.toBeNull()
    expect(promptProblem('  abc  ')).toBeNull()
  })

  it('refuses one longer than the API accepts', () => {
    expect(promptProblem('x'.repeat(MAX_PROMPT))).toBeNull()
    expect(promptProblem('x'.repeat(MAX_PROMPT + 1))).not.toBeNull()
  })
})

describe('remainingText', () => {
  it('says how many are left', () => {
    expect(remainingText(5, 20)).toBe('15 of 20 pictures left today.')
  })

  it('uses the singular for the last one', () => {
    expect(remainingText(19, 20)).toBe('1 picture left today.')
  })

  it('says when there are none left, and when that changes', () => {
    expect(remainingText(20, 20)).toContain('No pictures left')
    expect(remainingText(20, 20)).toContain('midnight UTC')
  })

  it('never shows a negative number', () => {
    expect(remainingText(25, 20)).toContain('No pictures left')
  })
})

describe('altFromPrompt', () => {
  it('trims the description', () => {
    expect(altFromPrompt('  a red kite ')).toBe('a red kite')
  })

  it('fits it into the length a picture description may have', () => {
    expect(altFromPrompt('x'.repeat(MAX_CAPTION + 50))).toHaveLength(MAX_CAPTION)
  })
})

describe('base64ToFile', () => {
  it('rebuilds the exact bytes with the given type and name', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 250])
    const file = base64ToFile(btoa(String.fromCharCode(...bytes)), 'image/jpeg', 'generated.jpg')

    expect(file.type).toBe('image/jpeg')
    expect(file.name).toBe('generated.jpg')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
  })
})

describe('previewSrc', () => {
  it('builds a data address the page can show', () => {
    expect(previewSrc('AAAA', 'image/jpeg')).toBe('data:image/jpeg;base64,AAAA')
  })
})
