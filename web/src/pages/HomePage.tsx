import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { PostSort } from '../api/types'
import { PostList } from '../components/PostCard'
import { ErrorNote, Spinner, TagPill } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'

type Feed = PostSort | 'Following'

export function HomePage() {
  const { user } = useAuth()
  const [feed, setFeed] = useState<Feed>('Latest')

  const posts = useAsync(
    () => (feed === 'Following' ? api.feed() : api.posts({ sort: feed, pageSize: 20 })),
    [feed],
  )

  const tags = useAsync(() => api.popularTags(12), [])

  return (
    <main className="main">
      <div className="layout-split">
        <div>
          <div className="tabs" role="tablist">
            {(['Latest', 'Trending', 'Popular'] as Feed[]).map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={feed === option}
                className={`tab${feed === option ? ' tab--active' : ''}`}
                onClick={() => setFeed(option)}
              >
                {option}
              </button>
            ))}
            {user && (
              <button
                role="tab"
                aria-selected={feed === 'Following'}
                className={`tab${feed === 'Following' ? ' tab--active' : ''}`}
                onClick={() => setFeed('Following')}
              >
                Following
              </button>
            )}
          </div>

          {posts.loading && <Spinner />}
          {posts.error && <ErrorNote message={posts.error} />}
          {posts.data && (
            <PostList
              posts={posts.data.items}
              emptyLabel={
                feed === 'Following'
                  ? 'Follow some writers or topics and their posts will show up here.'
                  : 'No posts yet. Be the first to publish something.'
              }
            />
          )}
        </div>

        <aside className="sidebar">
          <h2 className="sidebar__title">Discover topics</h2>
          <div className="pill-row">
            {tags.data?.map((tag) => <TagPill key={tag.id} tag={tag} />)}
          </div>

          {!user && (
            <div className="card" style={{ marginTop: '2rem' }}>
              <p style={{ marginTop: 0 }}>Write about anything you know.</p>
              <Link className="btn btn--primary btn--block" to="/register">Start writing</Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
