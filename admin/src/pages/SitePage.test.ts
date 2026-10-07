import { describe, expect, it } from 'vitest'
import { publicPostUrl } from '../components/ui'
import { categoryNameProblem, describeTheme } from './SitePage'

describe('categoryNameProblem', () => {
  const taken = ['Life and lessons', 'Technology and AI']

  it('accepts a new name', () => {
    expect(categoryNameProblem('Books', taken)).toBeNull()
  })

  it('requires a name that is more than spaces', () => {
    expect(categoryNameProblem('   ', taken)).toMatch(/name/)
  })

  it('refuses a name already in use, whatever its capitals or spacing', () => {
    expect(categoryNameProblem('  life AND lessons ', taken)).toMatch(/already/)
  })

  it('lets a category keep its own name when the others are passed in', () => {
    expect(categoryNameProblem('Life and Lessons', ['Technology and AI'])).toBeNull()
  })

  it('refuses a name with nothing an address could be made from', () => {
    expect(categoryNameProblem('!!! ???', taken)).toMatch(/letter or number/)
  })

  it('accepts names in other scripts', () => {
    expect(categoryNameProblem('زندگی', taken)).toBeNull()
  })

  it('limits the length', () => {
    expect(categoryNameProblem('x'.repeat(41), taken)).toMatch(/40/)
    expect(categoryNameProblem('x'.repeat(40), taken)).toBeNull()
  })
})

describe('describeTheme', () => {
  it('names the themes the site has', () => {
    expect(describeTheme('blue').name).toBe('Deep blue')
    expect(describeTheme('seagreen').name).toBe('Sea green')
  })

  it('still shows a theme this page has not been told about', () => {
    expect(describeTheme('sunset')).toEqual({ name: 'sunset', note: '', swatches: [] })
  })
})

describe('publicPostUrl', () => {
  it('points at the reading address', () => {
    expect(publicPostUrl('today-for-tomorrow-k3x9p')).toMatch(/\/read\/today-for-tomorrow-k3x9p$/)
  })

  it('has no address for a post that was never published', () => {
    expect(publicPostUrl(null)).toBeNull()
  })
})
