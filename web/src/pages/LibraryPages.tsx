import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { PostList } from '../components/PostCard'
import { EmptyState, ErrorNote, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'

export function DraftsPage() {
  const drafts = useAsync(() => api.drafts(), [])

  return (
    <main className="main">
      <div className="row" style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-read)', margin: 0 }}>Your drafts</h1>
        <Link className="btn btn--primary" to="/write" style={{ marginLeft: 'auto' }}>New post</Link>
      </div>

      {drafts.loading && <Spinner />}
      {drafts.error && <ErrorNote message={drafts.error} />}
      {drafts.data && (drafts.data.items.length > 0
        ? <PostList posts={drafts.data.items} emptyLabel="" />
        : (
          <EmptyState title="Nothing in progress">
            <p className="muted">Start writing and your drafts will appear here.</p>
            <Link className="btn btn--primary" to="/write">Write something</Link>
          </EmptyState>
        ))}
    </main>
  )
}

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
