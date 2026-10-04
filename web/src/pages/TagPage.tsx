import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { PostList } from '../components/PostCard'
import { ErrorNote, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'

export function TagPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [following, setFollowing] = useState(false)

  const posts = useAsync(() => api.posts({ tag: slug, pageSize: 20 }), [slug])
  const followed = useAsync(() => (user ? api.followedTags() : Promise.resolve([])), [user, slug])

  useEffect(() => {
    setFollowing(followed.data?.some((t) => t.slug === slug) ?? false)
  }, [followed.data, slug])

  async function toggleFollow() {
    const result = await api.followTag(slug)
    setFollowing(result.isActive)
  }

  return (
    <main className="main">
      <div className="row" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-read)', margin: 0 }}>#{slug}</h1>
        {user && (
          <button className={`btn${following ? ' btn--active' : ' btn--primary'}`} onClick={toggleFollow}>
            {following ? 'Following' : 'Follow topic'}
          </button>
        )}
      </div>

      {posts.loading && <Spinner />}
      {posts.error && <ErrorNote message={posts.error} />}
      {posts.data && <PostList posts={posts.data.items} emptyLabel="No posts on this topic yet." />}
    </main>
  )
}
