import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { ReactionKind, ReactionState } from '../api/types'
import { CopyLinkButton } from '../components/CopyLinkButton'
import { PostCard } from '../components/PostCard'
import { RichText } from '../components/RichText'
import { Avatar, EmptyState, ErrorNote, Spinner, TagPill, formatDate } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useTitle } from '../hooks/useTitle'
import { safeImageSrc } from '../lib/safeUrl'

export function PostPage() {
  const { slug = '' } = useParams()

  const loaded = useAsync(() => api.post(slug), [slug])
  const post = loaded.data
  useTitle(post?.title ?? null)

  // Totals come with the post; which ones this browser gave is asked for separately, so the post
  // itself is the same for every reader.
  const [reactions, setReactions] = useState<ReactionState | null>(null)
  const [reacting, setReacting] = useState<ReactionKind | null>(null)
  const [reactionError, setReactionError] = useState<string | null>(null)

  const postId = post?.id
  useEffect(() => {
    if (!postId) return
    let cancelled = false
    setReactions(null)
    api.reactions(postId).then((state) => { if (!cancelled) setReactions(state) }).catch(() => { /* The totals from the post are shown instead. */ })
    // Not awaited and never shown: counting a reader must not get in the way of reading.
    api.recordView(postId).catch(() => {})
    return () => { cancelled = true }
  }, [postId])

  const related = useAsync(() => (postId ? api.related(postId) : Promise.resolve([])), [postId])

  if (loaded.loading) return <main className="main"><Spinner /></main>
  if (loaded.error || !post) {
    return (
      <main className="main">
        <EmptyState title="This article isn't available">
          <p className="muted">{loaded.error ?? 'It may have been taken down.'}</p>
          <Link className="btn" to="/">Back to home</Link>
        </EmptyState>
      </main>
    )
  }

  async function react(kind: ReactionKind) {
    // One at a time: a second click before the first answer would otherwise undo it at once.
    if (reacting || !postId) return
    setReacting(kind)
    setReactionError(null)
    try {
      setReactions(await api.toggleReaction(postId, kind))
    } catch (err) {
      setReactionError(err instanceof Error ? err.message : 'Your reaction could not be saved.')
    } finally {
      setReacting(null)
    }
  }

  const link = `${window.location.origin}/p/${post.slug}`
  const cover = safeImageSrc(post.coverImageUrl)

  return (
    <main className="main main--reading">
      <article>
        <div className="article__title-row">
          <h1 className="article__title">{post.title}</h1>
          <CopyLinkButton url={link} compact />
        </div>
        {post.subtitle && <p className="article__subtitle">{post.subtitle}</p>}

        <div className="article__byline">
          <Avatar author={post.author} />
          <div style={{ flex: 1 }}>
            <Link to={`/@${post.author.handle}`}><strong>{post.author.displayName}</strong></Link>
            <div className="faint" style={{ fontSize: '0.85rem' }}>
              {formatDate(post.publishedAt)} · {post.readingTimeMinutes} min read
            </div>
          </div>
        </div>

        {cover && <img className="article__cover" src={cover} alt="" referrerPolicy="no-referrer" />}

        <RichText contentJson={post.contentJson} />

        {post.tags.length > 0 && (
          <div className="pill-row" style={{ marginTop: '2.5rem' }}>
            {post.tags.map((tag) => <TagPill key={tag.id} tag={tag} />)}
          </div>
        )}

        <div className="actionbar">
          <button className={`btn${reactions?.clapped ? ' btn--active' : ''}`} onClick={() => react('clap')} disabled={reacting !== null}
            aria-pressed={reactions?.clapped ?? false} title={reactions?.clapped ? 'Take back your clap' : 'Clap for this post'}>
            <span aria-hidden="true">👏</span> Clap <span className="reaction__count">{reactions?.clapCount ?? post.clapCount}</span>
          </button>
          <button className={`btn${reactions?.markedInsightful ? ' btn--active' : ''}`} onClick={() => react('insightful')} disabled={reacting !== null}
            aria-pressed={reactions?.markedInsightful ?? false} title={reactions?.markedInsightful ? 'Take back your mark' : 'Mark this post as insightful'}>
            <span aria-hidden="true">💡</span> Insightful <span className="reaction__count">{reactions?.insightfulCount ?? post.insightfulCount}</span>
          </button>
          <span className="actionbar__spacer" />
          <CopyLinkButton url={link} />
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
