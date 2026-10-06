import { useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { Empty, ErrorNote, PageHeader, Pagination, Spinner, formatNumber } from '../components/ui'

function formatWhen(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ActivityPage() {
  const [page, setPage] = useState(1)
  const activity = useAsync(() => api.activity(page), [page])

  return (
    <>
      <PageHeader title="Activity">
        <button className="btn" onClick={activity.reload} disabled={activity.loading}>Refresh</button>
      </PageHeader>
      <p className="muted">
        What has been done in this portal: sign-ins, posts taken down or published from the Posts list, deletions, topic changes and exports.
        Kept for 180 days. Writing and saving a post is not listed here; each post keeps its own history in the editor.
      </p>

      {activity.error && <ErrorNote message={activity.error} onRetry={activity.reload} />}
      {activity.loading && !activity.data && <Spinner />}

      {activity.data && (activity.data.items.length === 0 ? (
        <Empty title="Nothing recorded yet">Actions will appear here from now on.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>What</th><th>Details</th><th>Who</th></tr>
              </thead>
              <tbody>
                {activity.data.items.map((entry) => (
                  <tr key={entry.id} className={entry.action.startsWith('Failed') ? 'row--warn' : undefined}>
                    <td className="nowrap">{formatWhen(entry.at)}</td>
                    <td>{entry.action}</td>
                    <td>{entry.subject || <span className="muted">—</span>}</td>
                    <td className="muted">{entry.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted small">{formatNumber(activity.data.totalCount)} {activity.data.totalCount === 1 ? 'entry' : 'entries'}</p>
          <Pagination page={page} totalPages={activity.data.totalPages} onChange={setPage} />
        </>
      ))}
    </>
  )
}
