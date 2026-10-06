import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { PostDetail } from '../api/types'
import { CommentThread } from '../components/CommentThread'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { PostCard } from '../components/PostCard'
import { RichText } from '../components/RichText'
import { Avatar, EmptyState, ErrorNote, Spinner, TagPill, formatDate } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { safeImageSrc } from '../lib/safeUrl'

export function PostPage() {
  const { slug = '' } = useParams()
  const { user, allowPublicSignUp } = useAuth()
  // On a closed site visitors cannot sign in, so actions that require an account are not offered.
  const canEngage = Boolean(user) || allowPublicSignUp
  const navigate = useNavigate()

  const post = useAsync(() => api.post(slug), [slug])
  const [local, setLocal] = useState<PostDetail | null>(null)

  useEffect(() => setLocal(post.data), [post.data])

  const comments = useAsync(
    () => (local ? api.comments(local.id) : Promise.resolve([])),
    [local?.id],
  )

  const related = useAsync(
    () => (local ? api.related(local.id) : Promise.resolve([])),
    [local?.id],
  )

  if (post.loading) return <main className="main"><Spinner /></main>
  if (post.error) {
    return (
      <main className="main">
        <EmptyState title="This story isn't available">
          <p className="muted">{post.error}</p>
          <Link className="btn" to="/">Back to home</Link>
        </EmptyState>
      </main>
    )
  }
  if (!local) return null

  async function clap() {
    if (!user) return navigate('/login')
    const result = await api.clap(local!.id)
    setLocal((prev) => (prev ? { ...prev, clapCount: result.postClapCount } : prev))
  }

  async function toggleBookmark() {
    if (!user) return navigate('/login')
    const result = await api.toggleBookmark(local!.id)
    setLocal((prev) => (prev ? { ...prev, viewer: prev.viewer ? { ...prev.viewer, hasBookmarked: result.isActive } : prev.viewer } : prev))
  }

  async function toggleFollow() {
    if (!user) return navigate('/login')
    const result = await api.followUser(local!.author.handle)
    setLocal((prev) => (prev ? { ...prev, viewer: prev.viewer ? { ...prev.viewer, isFollowingAuthor: result.isActive } : prev.viewer } : prev))
  }

  const viewer = local.viewer

  return (
    <main className="main main--reading">
      <article>
        <div className="article__title-row">
          <h1 className="article__title">{local.title}</h1>
          <CopyLinkButton url={`${window.location.origin}/p/${local.slug}`} compact />
        </div>
        {local.subtitle && <p className="article__subtitle">{local.subtitle}</p>}

        <div className="article__byline">
          <Avatar author={local.author} />
          <div style={{ flex: 1 }}>
            <Link to={`/@${local.author.handle}`}><strong>{local.author.displayName}</strong></Link>
            <div className="faint" style={{ fontSize: '0.85rem' }}>
              {formatDate(local.publishedAt)} · {local.readingTimeMinutes} min read
            </div>
          </div>

          {viewer && !viewer.isAuthor && (
            <button className={`btn${viewer.isFollowingAuthor ? ' btn--active' : ''}`} onClick={toggleFollow}>
              {viewer.isFollowingAuthor ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {safeImageSrc(local.coverImageUrl) && (
          <img className="article__cover" src={safeImageSrc(local.coverImageUrl)} alt="" referrerPolicy="no-referrer" />
        )}

        <RichText contentJson={local.contentJson} />

        {local.tags.length > 0 && (
          <div className="pill-row" style={{ marginTop: '2.5rem' }}>
            {local.tags.map((tag) => <TagPill key={tag.id} tag={tag} />)}
          </div>
        )}

        <div className="actionbar">
          {canEngage ? (
            <button className={`btn${viewer?.hasClapped ? ' btn--active' : ''}`} onClick={clap} aria-label="Clap for this post">
              👏 {local.clapCount}
            </button>
          ) : (
            <span className="faint" aria-label={`${local.clapCount} claps`}>👏 {local.clapCount}</span>
          )}
          <span className="faint" style={{ fontSize: '0.85rem' }}>{local.commentCount} responses</span>
          <span className="actionbar__spacer" />
          <CopyLinkButton url={`${window.location.origin}/p/${local.slug}`} />
          {canEngage && (
            <button className={`btn${viewer?.hasBookmarked ? ' btn--active' : ''}`} onClick={toggleBookmark}>
              {viewer?.hasBookmarked ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      </article>

      {comments.error && <ErrorNote message={comments.error} />}
      <CommentThread
        postId={local.id}
        comments={comments.data ?? []}
        onChanged={() => {
          comments.reload()
          post.reload()
        }}
      />

      {related.data && related.data.length > 0 && (
        <section style={{ marginTop: '3rem' }}>
          <h2 className="sidebar__title">More on this topic</h2>
          {related.data.map((item) => <PostCard key={item.id} post={item} />)}
        </section>
      )}
    </main>
  )
}
