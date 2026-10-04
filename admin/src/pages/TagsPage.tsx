import { useState } from 'react'
import { api } from '../api/client'
import type { AdminTag } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useConfirm, useToast } from '../components/feedback'
import { Empty, ErrorNote, PageHeader, Spinner, formatNumber } from '../components/ui'

export function TagsPage() {
  const confirm = useConfirm()
  const notify = useToast()
  const tags = useAsync(() => api.tags(), [])

  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [merging, setMerging] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      notify(success)
      tags.reload()
      return true
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That did not work.', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function rename(tag: AdminTag) {
    const name = draftName.trim()
    if (!name || name === tag.name) { setEditing(null); return }
    if (await run(() => api.renameTag(tag.id, name), `Renamed to “${name}”.`)) setEditing(null)
  }

  async function merge(tag: AdminTag, target: AdminTag) {
    const ok = await confirm({
      title: `Merge “${tag.name}” into “${target.name}”?`,
      message: <>All {formatNumber(tag.postCount)} posts and {formatNumber(tag.followers)} followers of “{tag.name}” move to “{target.name}”, then “{tag.name}” is removed. This cannot be undone.</>,
      confirmLabel: 'Merge topics',
      danger: true,
    })
    if (!ok) return

    await run(() => api.mergeTag(tag.id, target.id), `Merged into “${target.name}”.`)
    setMerging(null)
  }

  async function remove(tag: AdminTag) {
    const ok = await confirm({
      title: `Delete “${tag.name}”?`,
      message: <>The topic is removed from its {formatNumber(tag.postCount)} posts and from {formatNumber(tag.followers)} followers’ lists. The posts themselves are kept.</>,
      confirmLabel: 'Delete topic',
      danger: true,
    })
    if (ok) await run(() => api.deleteTag(tag.id), 'Topic deleted.')
  }

  return (
    <>
      <PageHeader title="Topics" />

      {tags.error && <ErrorNote message={tags.error} onRetry={tags.reload} />}
      {tags.loading && !tags.data && <Spinner />}

      {tags.data && (tags.data.length === 0 ? (
        <Empty title="No topics yet">Topics appear as writers tag their posts.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Address</th><th className="num">Posts</th><th className="num">Followers</th><th></th></tr></thead>
            <tbody>
              {tags.data.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    {editing === tag.id ? (
                      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void rename(tag) }}>
                        <input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={40} aria-label={`New name for ${tag.name}`} autoFocus />
                        <button className="btn btn--small btn--primary" disabled={busy}>Save</button>
                        <button type="button" className="btn btn--small" onClick={() => setEditing(null)}>Cancel</button>
                      </form>
                    ) : tag.name}
                  </td>
                  <td className="muted">/tag/{tag.slug}</td>
                  <td className="num">{formatNumber(tag.postCount)}</td>
                  <td className="num">{formatNumber(tag.followers)}</td>
                  <td className="actions">
                    {merging === tag.id ? (
                      <select
                        aria-label={`Merge ${tag.name} into`}
                        defaultValue=""
                        autoFocus
                        onChange={(e) => {
                          const target = tags.data!.find((t) => t.id === e.target.value)
                          if (target) void merge(tag, target)
                        }}
                        onBlur={() => setMerging(null)}
                      >
                        <option value="" disabled>Merge into…</option>
                        {tags.data!.filter((t) => t.id !== tag.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    ) : (
                      <>
                        <button className="btn btn--small" disabled={busy} onClick={() => { setEditing(tag.id); setDraftName(tag.name) }}>Rename</button>
                        <button className="btn btn--small" disabled={busy || tags.data!.length < 2} onClick={() => setMerging(tag.id)}>Merge</button>
                        <button className="btn btn--small btn--danger" disabled={busy} onClick={() => remove(tag)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
