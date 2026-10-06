import { useState } from 'react'
import { api } from '../api/client'
import type { PostSort } from '../api/types'
import { PagedPostList } from '../components/PostCard'
import { TagPill } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { usePagedPosts } from '../hooks/usePagedPosts'

const FEEDS: PostSort[] = ['Latest', 'Trending', 'Popular']

export function HomePage() {
  const [feed, setFeed] = useState<PostSort>('Latest')

  const list = usePagedPosts({ sort: feed }, [feed], null)
  const tags = useAsync(() => api.popularTags(12), [])

  return (
    <main className="main">
      <div className="layout-split">
        <div>
          <div className="tabs" role="tablist">
            {FEEDS.map((option) => (
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
          </div>

          <PagedPostList list={list} emptyLabel={feed === 'Trending' ? 'Nothing new in the last few days.' : 'Nothing published yet. Check back soon.'} />
        </div>

        {tags.data && tags.data.length > 0 && (
          <aside className="sidebar">
            <h2 className="sidebar__title">Topics</h2>
            <div className="pill-row">
              {tags.data.map((tag) => <TagPill key={tag.id} tag={tag} />)}
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}
