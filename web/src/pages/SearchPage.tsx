import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PostSort } from '../api/types'
import { PagedPostList } from '../components/PostCard'
import { usePagedPosts } from '../hooks/usePagedPosts'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [sort, setSort] = useState<PostSort>('Latest')

  // Nothing is fetched until there is something to search for.
  const list = usePagedPosts(q ? { q, sort } : null, [q, sort], q ? `Search: ${q}` : 'Search')

  return (
    <main className="main">
      <h1 style={{ fontFamily: 'var(--font-read)', fontSize: '1.6rem' }}>
        {q ? <>Results for “{q}”</> : 'Search'}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = String(new FormData(e.currentTarget).get('q') ?? '').trim()
          setParams(value ? { q: value } : {})
        }}
        style={{ margin: '1rem 0 1.5rem' }}
      >
        <input key={q} name="q" defaultValue={q} placeholder="Search articles" aria-label="Search articles" />
      </form>

      {q ? (
        <>
          <div className="tabs" role="tablist">
            {(['Latest', 'Popular', 'Trending'] as PostSort[]).map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={sort === option}
                className={`tab${sort === option ? ' tab--active' : ''}`}
                onClick={() => setSort(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {list.totalCount !== null && (
            <p className="faint" style={{ fontSize: '0.85rem' }}>
              {list.totalCount} {list.totalCount === 1 ? 'article' : 'articles'}
            </p>
          )}
          <PagedPostList list={list} emptyLabel="Nothing matched that search." />
        </>
      ) : (
        <p className="muted">Type a word or phrase above to search every article.</p>
      )}
    </main>
  )
}
