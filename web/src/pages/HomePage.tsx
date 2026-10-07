import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { PostSort } from '../api/types'
import { PagedPostList } from '../components/PostCard'
import { TagPill } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { usePagedPosts } from '../hooks/usePagedPosts'
import { useSite } from '../lib/siteContext'

const FEEDS: PostSort[] = ['Latest', 'Trending', 'Popular']

export function HomePage() {
  const { categories } = useSite()
  const [feed, setFeed] = useState<PostSort>('Latest')

  // The chosen category lives in the address, so a category can be linked to and the Back button works.
  const [params, setParams] = useSearchParams()
  const category = (params.get('category') ?? '').trim().toLowerCase()
  const current = categories.find((c) => c.slug === category)

  const list = usePagedPosts({ sort: feed, category: category || undefined }, [feed, category], current?.name ?? null)
  const tags = useAsync(() => api.popularTags(12), [])

  const choose = (slug: string) => setParams(slug ? { category: slug } : {})

  return (
    <main className="main">
      {categories.length > 0 && (
        <nav className="categories" aria-label="Categories">
          <button className={`category${category === '' ? ' category--active' : ''}`} aria-current={category === '' ? 'page' : undefined} onClick={() => choose('')}>
            All
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`category${category === c.slug ? ' category--active' : ''}`} aria-current={category === c.slug ? 'page' : undefined}
              onClick={() => choose(c.slug)}>
              {c.name}
            </button>
          ))}
        </nav>
      )}

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

          <PagedPostList
            list={list}
            emptyLabel={
              feed === 'Trending' ? 'Nothing new in the last few days.'
                : category ? 'Nothing in this category yet.'
                : 'Nothing published yet. Check back soon.'
            }
          />
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
