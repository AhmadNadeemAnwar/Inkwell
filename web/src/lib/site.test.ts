import { describe, expect, it } from 'vitest'
import type { PostSummary } from '../api/types'
import { mergePosts } from '../hooks/usePagedPosts'
import { normalise, pageTitle } from './site'

describe('pageTitle', () => {
  it('puts the page first and the site second', () => {
    expect(pageTitle('What I learned')).toBe('What I learned · Inkwell')
  })

  it('is just the site name when the page has no name yet', () => {
    expect(pageTitle()).toBe('Inkwell')
    expect(pageTitle(null)).toBe('Inkwell')
    expect(pageTitle('   ')).toBe('Inkwell')
  })

  it('tidies stray spacing and line breaks in a title', () => {
    expect(pageTitle('  Two\n  lines ')).toBe('Two lines · Inkwell')
  })
})

describe('portfolio address', () => {
  it('is off when nothing is set, so no dead link is shown', () => {
    expect(normalise(undefined)).toBeNull()
    expect(normalise('')).toBeNull()
    expect(normalise('   ')).toBeNull()
  })

  it('accepts an https address and drops a trailing slash', () => {
    expect(normalise('https://ahmadnadeem.dev/')).toBe('https://ahmadnadeem.dev')
  })

  it.each(['http://ahmadnadeem.dev', 'javascript:alert(1)', 'ahmadnadeem.dev', '//ahmadnadeem.dev'])('stays off for %s', (value) => {
    expect(normalise(value)).toBeNull()
  })
})

describe('mergePosts', () => {
  const post = (id: string) => ({ id, title: id }) as PostSummary
  const ids = (posts: PostSummary[]) => posts.map((p) => p.id)

  it('adds the next page after what is already shown', () => {
    expect(ids(mergePosts([post('a'), post('b')], [post('c'), post('d')]))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('drops a post that is already on screen', () => {
    // A new post was published between page 1 and page 2, so "b" slid onto page 2.
    expect(ids(mergePosts([post('a'), post('b')], [post('b'), post('c')]))).toEqual(['a', 'b', 'c'])
  })

  it('copes with an empty first page or an empty next page', () => {
    expect(ids(mergePosts([], [post('a')]))).toEqual(['a'])
    expect(ids(mergePosts([post('a')], []))).toEqual(['a'])
  })

  it('does not change the list it was given', () => {
    const shown = [post('a')]

    mergePosts(shown, [post('b')])

    expect(ids(shown)).toEqual(['a'])
  })
})
