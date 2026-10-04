import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { PostList } from '../components/PostCard'
import { Avatar, EmptyState, ErrorNote, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { safeHref } from '../lib/safeUrl'

export function ProfilePage() {
  const { handle: segment = '' } = useParams()
  // The URL segment is "@name"; anything without the "@" is not a profile address.
  const handle = segment.startsWith('@') ? segment.slice(1) : ''
  const { user } = useAuth()

  const profile = useAsync(
    () => (handle ? api.profile(handle) : Promise.reject(new Error('This page does not exist.'))),
    [handle],
  )
  const posts = useAsync(
    () => (handle ? api.posts({ author: handle, pageSize: 20 }) : Promise.resolve(null)),
    [handle],
  )

  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  useEffect(() => {
    setFollowing(profile.data?.isFollowing ?? false)
    setFollowerCount(profile.data?.followerCount ?? 0)
  }, [profile.data])

  if (profile.loading) return <main className="main"><Spinner /></main>
  if (profile.error || !profile.data) {
    return (
      <main className="main">
        <EmptyState title="No such writer">
          <p className="muted">{profile.error}</p>
        </EmptyState>
      </main>
    )
  }

  const p = profile.data

  async function toggleFollow() {
    const result = await api.followUser(handle)
    setFollowing(result.isActive)
    setFollowerCount((count) => count + (result.isActive ? 1 : -1))
  }

  return (
    <main className="main">
      <header className="profile__head">
        <Avatar author={p} large />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-read)', margin: 0 }}>{p.displayName}</h1>
          <p className="faint" style={{ margin: '0.1rem 0' }}>@{p.handle}</p>
          {p.bio && <p style={{ margin: '0.5rem 0 0' }}>{p.bio}</p>}
          {safeHref(p.websiteUrl) && (
            <p style={{ margin: '0.35rem 0 0' }}>
              <a href={safeHref(p.websiteUrl)} target="_blank" rel="noopener noreferrer nofollow">{p.websiteUrl}</a>
            </p>
          )}
          <div className="profile__stats">
            <span>{p.postCount} posts</span>
            <span>{followerCount} followers</span>
            <span>{p.followingCount} following</span>
          </div>
        </div>

        {user && !p.isSelf && (
          <button className={`btn${following ? ' btn--active' : ' btn--primary'}`} onClick={toggleFollow}>
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </header>

      {posts.loading && <Spinner />}
      {posts.error && <ErrorNote message={posts.error} />}
      {posts.data && (
        <PostList
          posts={posts.data.items}
          emptyLabel={p.isSelf ? "You haven't published anything yet." : 'No published posts yet.'}
        />
      )}
    </main>
  )
}
