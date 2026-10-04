import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { PostSort } from '../api/types'
import { PostList } from '../components/PostCard'
import { ErrorNote, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [sort, setSort] = useState<PostSort>('Latest')

  const results = useAsync(() => api.posts({ q, sort, pageSize: 20 }), [q, sort])

  return (
    <main className="main">
      <h1 style={{ fontFamily: 'var(--font-read)', fontSize: '1.6rem' }}>
        {q ? <>Results for “{q}”</> : 'Search'}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = new FormData(e.currentTarget).get('q')
          setParams(value ? { q: String(value) } : {})
        }}
        style={{ margin: '1rem 0 1.5rem' }}
      >
        <input name="q" defaultValue={q} placeholder="Search articles" aria-label="Search articles" />
      </form>

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

      {results.loading && <Spinner />}
      {results.error && <ErrorNote message={results.error} />}
      {results.data && (
        <>
          <p className="faint" style={{ fontSize: '0.85rem' }}>
            {results.data.totalCount} {results.data.totalCount === 1 ? 'article' : 'articles'}
          </p>
          <PostList posts={results.data.items} emptyLabel="Nothing matched that search." />
        </>
      )}
    </main>
  )
}
