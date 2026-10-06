import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { PostList } from '../components/PostCard'
import { EmptyState, ErrorNote, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

export function BookmarksPage() {
  const saved = useAsync(() => api.bookmarks(), [])

  return (
    <main className="main">
      <h1 style={{ fontFamily: 'var(--font-read)' }}>Reading list</h1>

      {saved.loading && <Spinner />}
      {saved.error && <ErrorNote message={saved.error} />}
      {saved.data && (saved.data.items.length > 0
        ? <PostList posts={saved.data.items} emptyLabel="" />
        : (
          <EmptyState title="Nothing saved yet">
            <p className="muted">Tap Save on any story to keep it here for later.</p>
            <Link className="btn" to="/">Find something to read</Link>
          </EmptyState>
        ))}
    </main>
  )
}
