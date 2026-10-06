import { Link } from 'react-router-dom'
import type { PostSummary } from '../api/types'
import { Avatar, TagPill, formatDate } from './ui'

export function PostCard({ post }: { post: PostSummary }) {
  const href = `/p/${post.slug}`

  return (
    <article className="post-card">
      <div className="post-card__byline">
        <Avatar author={post.author} />
        <Link to={`/@${post.author.handle}`}>{post.author.displayName}</Link>
        {post.publishedAt && <span className="faint">· {formatDate(post.publishedAt)}</span>}
        {post.status === 'Draft' && <span className="pill">Draft</span>}
      </div>

      <Link to={href}>
        <h2 className="post-card__title">{post.title}</h2>
        <p className="post-card__excerpt">{post.excerpt}</p>
      </Link>

      <div className="post-card__meta">
        <span>{post.readingTimeMinutes} min read</span>
        {post.clapCount > 0 && <span>· {post.clapCount} {post.clapCount === 1 ? 'clap' : 'claps'}</span>}
        {post.insightfulCount > 0 && <span>· {post.insightfulCount} found it insightful</span>}
        {post.tags.length > 0 && (
          <span className="pill-row" style={{ marginLeft: 'auto' }}>
            {post.tags.slice(0, 2).map((tag) => <TagPill key={tag.id} tag={tag} />)}
          </span>
        )}
      </div>
    </article>
  )
}

export function PostList({ posts, emptyLabel }: { posts: PostSummary[]; emptyLabel: string }) {
  if (posts.length === 0) {
    return <div className="empty"><p>{emptyLabel}</p></div>
  }

  return (
    <div className="post-list">
      {posts.map((post) => <PostCard key={post.id} post={post} />)}
    </div>
  )
}
