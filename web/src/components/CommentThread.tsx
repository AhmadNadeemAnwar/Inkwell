import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Comment } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Avatar, ErrorNote, formatDate } from './ui'

interface Props {
  postId: string
  comments: Comment[]
  onChanged: () => void
}

export function CommentThread({ postId, comments, onChanged }: Props) {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent, text: string, parentId: string | null) {
    event.preventDefault()
    if (!text.trim()) return

    setBusy(true)
    setError(null)
    try {
      await api.addComment(postId, { body: text, parentId })
      setBody('')
      setReplyBody('')
      setReplyTo(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your comment.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this comment?')) return
    try {
      await api.deleteComment(id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the comment.')
    }
  }

  const total = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0)

  return (
    <section aria-label="Responses">
      <h2 style={{ fontFamily: 'var(--font-read)' }}>
        {total === 0 ? 'Responses' : `${total} ${total === 1 ? 'response' : 'responses'}`}
      </h2>

      {error && <ErrorNote message={error} />}

      {user ? (
        <form onSubmit={(e) => submit(e, body, null)} className="stack">
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What are your thoughts?"
            aria-label="Write a response"
          />
          <button className="btn btn--primary" disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Respond'}
          </button>
        </form>
      ) : (
        <p className="muted">
          <Link to="/login">Sign in</Link> to join the conversation.
        </p>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        {comments.map((comment) => (
          <div className="comment" key={comment.id}>
            <CommentBody comment={comment} onDelete={remove} canDelete={user?.id === comment.author.id} />

            {user && (
              <div className="comment__actions">
                <button
                  className="btn btn--ghost"
                  style={{ padding: 0, fontSize: '0.8rem' }}
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                >
                  {replyTo === comment.id ? 'Cancel' : 'Reply'}
                </button>
              </div>
            )}

            {replyTo === comment.id && (
              <form onSubmit={(e) => submit(e, replyBody, comment.id)} className="stack" style={{ marginTop: '0.75rem' }}>
                <textarea
                  rows={2}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Reply to ${comment.author.displayName}`}
                  aria-label="Write a reply"
                />
                <button className="btn btn--primary" disabled={busy || !replyBody.trim()}>Reply</button>
              </form>
            )}

            {comment.replies.length > 0 && (
              <div className="comment__replies">
                {comment.replies.map((reply) => (
                  <CommentBody
                    key={reply.id}
                    comment={reply}
                    onDelete={remove}
                    canDelete={user?.id === reply.author.id}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CommentBody({
  comment, onDelete, canDelete,
}: { comment: Comment; onDelete: (id: string) => void; canDelete: boolean }) {
  return (
    <div>
      <div className="comment__head">
        <Avatar author={comment.author} />
        <Link to={`/@${comment.author.handle}`}>{comment.author.displayName}</Link>
        <span className="faint">· {formatDate(comment.createdAt)}</span>
        {canDelete && !comment.isDeleted && (
          <button
            className="btn btn--ghost btn--danger"
            style={{ padding: 0, marginLeft: 'auto', fontSize: '0.8rem' }}
            onClick={() => onDelete(comment.id)}
          >
            Delete
          </button>
        )}
      </div>

      {comment.isDeleted
        ? <p className="comment__body comment__deleted">This response was deleted.</p>
        : <p className="comment__body">{comment.body}</p>}
    </div>
  )
}
