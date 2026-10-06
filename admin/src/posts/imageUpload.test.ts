import { describe, expect, it } from 'vitest'
import { MAX_EDGE, extensionFor, fitWithin } from './imageUpload'

describe('fitWithin', () => {
  it('leaves a picture that already fits at its own size', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(MAX_EDGE, 900)).toEqual({ width: MAX_EDGE, height: 900 })
  })

  it('never enlarges a small picture', () => {
    expect(fitWithin(120, 80)).toEqual({ width: 120, height: 80 })
  })

  it('shrinks a wide picture so its width is the limit, keeping its shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  it('shrinks a tall picture so its height is the limit, keeping its shape', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  it('never rounds the short edge of a very thin picture down to nothing', () => {
    expect(fitWithin(16000, 2)).toEqual({ width: 1600, height: 1 })
  })

  it('copes with a picture that reports no size', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 })
  })

  it('uses the limit it is given', () => {
    expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50 })
  })
})

describe('extensionFor', () => {
  it('names the file after what it really is', () => {
    expect(extensionFor('image/png')).toBe('png')
    expect(extensionFor('image/webp')).toBe('webp')
    expect(extensionFor('image/jpeg')).toBe('jpg')
  })
})
