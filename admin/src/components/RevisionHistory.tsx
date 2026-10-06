import { useState } from 'react'
import { api } from '../api/client'
import type { PostRevision, PostRevisionDetail } from '../api/types'
import { useConfirm } from './feedback'
import { ErrorNote, formatDateTime } from './ui'

/**
 * Earlier versions of a post. A copy is kept when the title or body changes, at most once every ten
 * minutes, and the newest 30 are kept. Restoring puts a version back into the editor as unsaved
 * changes, so nothing is overwritten until the writer saves.
 */
export function RevisionHistory({ postId, onRestore }: { postId: string; onRestore: (revision: PostRevisionDetail) => void }) {
  const confirm = useConfirm()
  const [revisions, setRevisions] = useState<PostRevision[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRevisions(await api.revisions(postId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Earlier versions could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function restore(revision: PostRevision) {
    const ok = await confirm({
      title: 'Put this version back into the editor?',
      message: <>The title and all sections are replaced with the version from {formatDateTime(revision.createdAt)}. Nothing is saved until you press Save, so you can still back out.</>,
      confirmLabel: 'Restore this version',
    })
    if (!ok) return

    setBusyId(revision.id)
    setError(null)
    try {
      onRestore(await api.revision(postId, revision.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That version could not be loaded.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <details className="history" onToggle={(event) => { if (event.currentTarget.open) void load() }}>
      <summary>Earlier versions</summary>

      {error && <ErrorNote message={error} onRetry={load} />}
      {loading && !revisions && <p className="muted">Loading…</p>}
      {revisions && revisions.length === 0 && (
        <p className="muted">None yet. A copy is kept when you change the title or the writing, at most once every ten minutes.</p>
      )}
      {revisions && revisions.length > 0 && (
        <ul className="history__list">
          {revisions.map((revision) => (
            <li key={revision.id}>
              <span>{formatDateTime(revision.createdAt)}</span>
              <span className="muted history__title">{revision.title}</span>
              <button type="button" className="btn btn--small" disabled={busyId !== null} onClick={() => restore(revision)}>
                {busyId === revision.id ? 'Loading…' : 'Restore'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
