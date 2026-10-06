import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { PostDetail, ReactionKind, ReactionState } from '../api/types'
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

  // Totals come with the post; which ones this browser gave is asked for separately, so the post
  // itself is the same for every reader.
  const [reactions, setReactions] = useState<ReactionState | null>(null)
  const [reacting, setReacting] = useState<ReactionKind | null>(null)
  const [reactionError, setReactionError] = useState<string | null>(null)

  const postId = local?.id
  useEffect(() => {
    if (!postId) return
    let cancelled = false
    setReactions(null)
    api.reactions(postId).then((state) => { if (!cancelled) setReactions(state) }).catch(() => { /* The totals from the post are shown instead. */ })
    // Not awaited and never shown: counting a reader must not get in the way of reading.
    api.recordView(postId).catch(() => {})
    return () => { cancelled = true }
  }, [postId])

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

  async function react(kind: ReactionKind) {
    // One at a time: a second click before the first answer would otherwise undo it at once.
    if (reacting) return
    setReacting(kind)
    setReactionError(null)
    try {
      setReactions(await api.toggleReaction(local!.id, kind))
    } catch (err) {
      setReactionError(err instanceof Error ? err.message : 'Your reaction could not be saved.')
    } finally {
      setReacting(null)
    }
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
          <button className={`btn${reactions?.clapped ? ' btn--active' : ''}`} onClick={() => react('clap')} disabled={reacting !== null}
            aria-pressed={reactions?.clapped ?? false} title={reactions?.clapped ? 'Take back your clap' : 'Clap for this post'}>
            <span aria-hidden="true">👏</span> Clap <span className="reaction__count">{reactions?.clapCount ?? local.clapCount}</span>
          </button>
          <button className={`btn${reactions?.markedInsightful ? ' btn--active' : ''}`} onClick={() => react('insightful')} disabled={reacting !== null}
            aria-pressed={reactions?.markedInsightful ?? false} title={reactions?.markedInsightful ? 'Take back your mark' : 'Mark this post as insightful'}>
            <span aria-hidden="true">💡</span> Insightful <span className="reaction__count">{reactions?.insightfulCount ?? local.insightfulCount}</span>
          </button>
          <span className="actionbar__spacer" />
          <CopyLinkButton url={`${window.location.origin}/p/${local.slug}`} />
          {canEngage && (
            <button className={`btn${viewer?.hasBookmarked ? ' btn--active' : ''}`} onClick={toggleBookmark}>
              {viewer?.hasBookmarked ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      </article>

      {reactionError && <ErrorNote message={reactionError} />}

      {related.data && related.data.length > 0 && (
        <section style={{ marginTop: '3rem' }}>
          <h2 className="sidebar__title">More on this topic</h2>
          {related.data.map((item) => <PostCard key={item.id} post={item} />)}
        </section>
      )}
    </main>
  )
}
