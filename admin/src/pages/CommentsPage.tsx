import { useState } from 'react'
import { api } from '../api/client'
import type { AdminComment } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useConfirm, useToast } from '../components/feedback'
import { Badge, Empty, ErrorNote, PageHeader, Pagination, Spinner, formatDateTime, publicPostUrl } from '../components/ui'

export function CommentsPage() {
  const confirm = useConfirm()
  const notify = useToast()
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)

  const comments = useAsync(() => api.comments(page), [page])

  async function remove(comment: AdminComment) {
    const ok = await confirm({
      title: 'Remove this comment?',
      message: <>The comment by @{comment.authorHandle} is blanked and shown as “deleted”. Replies under it stay in place.</>,
      confirmLabel: 'Remove comment',
      danger: true,
    })
    if (!ok) return

    setBusyId(comment.id)
    try {
      await api.deleteComment(comment.id)
      notify('Comment removed.')
      comments.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="Comments" />

      {comments.error && <ErrorNote message={comments.error} onRetry={comments.reload} />}
      {comments.loading && !comments.data && <Spinner />}

      {comments.data && (comments.data.items.length === 0 ? (
        <Empty title="No comments yet">When readers respond to posts, their comments appear here.</Empty>
      ) : (
        <>
          <ul className="cards">
            {comments.data.items.map((comment) => {
              const url = publicPostUrl(comment.postSlug)
              return (
                <li key={comment.id} className={`card${comment.isDeleted ? ' card--dim' : ''}${busyId === comment.id ? ' is-busy' : ''}`}>
                  <div className="card__head">
                    <strong>@{comment.authorHandle}</strong>
                    <span className="muted">on {url ? <a href={url} target="_blank" rel="noopener noreferrer">{comment.postTitle}</a> : comment.postTitle}</span>
                    <span className="muted">· {formatDateTime(comment.createdAt)}</span>
                    {comment.isReply && <Badge>reply</Badge>}
                    {comment.isDeleted && <Badge tone="bad">removed</Badge>}
                  </div>
                  <p className="card__body">{comment.isDeleted ? 'This comment was removed.' : comment.body}</p>
                  {!comment.isDeleted && (
                    <div className="card__actions">
                      <button className="btn btn--small btn--danger" onClick={() => remove(comment)} disabled={busyId === comment.id}>Remove</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <Pagination page={page} totalPages={comments.data.totalPages} onChange={setPage} />
        </>
      ))}
    </>
  )
}
