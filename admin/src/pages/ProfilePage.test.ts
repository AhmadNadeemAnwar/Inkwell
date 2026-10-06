import { describe, expect, it } from 'vitest'
import { profileProblem } from './ProfilePage'

describe('profileProblem', () => {
  it('finds nothing wrong with a complete profile', () => {
    expect(profileProblem('Ahmad Nadeem', 'Writes about software.', 'https://example.com')).toBeNull()
  })

  it('accepts a profile with only a name', () => {
    expect(profileProblem('Ahmad', '', '')).toBeNull()
  })

  it('requires a name that is more than spaces', () => {
    expect(profileProblem('   ', '', '')).toMatch(/name is required/)
  })

  it('limits the name and the bio', () => {
    expect(profileProblem('x'.repeat(61), '', '')).toMatch(/60/)
    expect(profileProblem('Ahmad', 'x'.repeat(301), '')).toMatch(/300/)
  })

  it.each(['example.com', 'javascript:alert(1)', 'ftp://example.com'])('refuses the website %s', (url) => {
    expect(profileProblem('Ahmad', '', url)).toMatch(/http/)
  })
})
