import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { PagedPostList } from '../components/PostCard'
import { Avatar, EmptyState, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { usePagedPosts } from '../hooks/usePagedPosts'
import { safeHref } from '../lib/safeUrl'

export function ProfilePage() {
  const { handle: segment = '' } = useParams()
  // The URL segment is "@name"; anything without the "@" is not a profile address.
  const handle = segment.startsWith('@') ? segment.slice(1) : ''

  const profile = useAsync(
    () => (handle ? api.profile(handle) : Promise.reject(new Error('This page does not exist.'))),
    [handle],
  )
  const list = usePagedPosts(handle ? { author: handle } : null, [handle], profile.data?.displayName ?? null)

  if (profile.loading) return <main className="main"><Spinner /></main>
  if (profile.error || !profile.data) {
    return (
      <main className="main">
        <EmptyState title="Page not found">
          <p className="muted">{profile.error}</p>
        </EmptyState>
      </main>
    )
  }

  const p = profile.data
  const website = safeHref(p.websiteUrl)

  return (
    <main className="main">
      <header className="profile__head">
        <Avatar author={p} large />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-read)', margin: 0 }}>{p.displayName}</h1>
          <p className="faint" style={{ margin: '0.1rem 0' }}>@{p.handle}</p>
          {p.bio && <p style={{ margin: '0.5rem 0 0' }}>{p.bio}</p>}
          {website && (
            <p style={{ margin: '0.35rem 0 0' }}>
              <a href={website} target="_blank" rel="noopener noreferrer nofollow">{p.websiteUrl}</a>
            </p>
          )}
          <div className="profile__stats">
            <span>{p.postCount} {p.postCount === 1 ? 'post' : 'posts'}</span>
          </div>
        </div>
      </header>

      <PagedPostList list={list} emptyLabel="No published posts yet." />
    </main>
  )
}
