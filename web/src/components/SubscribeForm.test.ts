import { describe, expect, it } from 'vitest'
import { emailProblem } from './SubscribeForm'

describe('emailProblem', () => {
  it.each(['reader@example.com', '  reader@example.com  ', 'first.last+tag@sub.example.co.uk', 'a@b.io'])('accepts %s', (value) => {
    expect(emailProblem(value)).toBeNull()
  })

  it('asks for an address when there is none', () => {
    expect(emailProblem('')).toMatch(/Enter your email/)
    expect(emailProblem('   ')).toMatch(/Enter your email/)
  })

  it.each(['not-an-address', 'two@@example.com', 'no-domain@', '@no-name.com', 'nodot@localhost', 'trailing@example.', 'double..dot@example.com'])(
    'refuses %s',
    (value) => {
      expect(emailProblem(value)).toMatch(/does not look like/)
    },
  )

  it('points out a space, which is the usual slip', () => {
    expect(emailProblem('reader @example.com')).toMatch(/no spaces/)
  })

  it('refuses an address longer than any real one', () => {
    expect(emailProblem(`${'a'.repeat(250)}@example.com`)).toMatch(/too long/)
  })
})
