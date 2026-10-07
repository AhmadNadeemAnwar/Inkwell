import { useState } from 'react'
import { api } from '../api/client'
import type { NotifyResult, Subscriber } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useConfirm, useToast } from '../components/feedback'
import { Badge, Empty, ErrorNote, PageHeader, Pagination, Spinner, StatTile, formatDate, formatNumber } from '../components/ui'

const statusLabel: Record<Subscriber['status'], string> = { Confirmed: 'Subscribed', Pending: 'Waiting to confirm', Unsubscribed: 'Unsubscribed' }
const statusTone: Record<Subscriber['status'], 'good' | 'warn' | 'neutral'> = { Confirmed: 'good', Pending: 'warn', Unsubscribed: 'neutral' }

const people = (count: number) => `${formatNumber(count)} ${count === 1 ? 'subscriber' : 'subscribers'}`

/** What to tell the owner after an announcement, including when some emails are still to go. */
export function describeNotifyResult(result: NotifyResult): { message: string; kind: 'success' | 'error' } {
  if (result.sent === 0) {
    return { message: 'No emails could be sent. The mail service may have reached its daily allowance; try again tomorrow.', kind: 'error' }
  }
  if (result.remaining > 0) {
    return {
      message: `Sent to ${people(result.sent)}. ${people(result.remaining)} still to go: press Notify again tomorrow, when the daily allowance resets.`,
      kind: 'success',
    }
  }
  return { message: `Sent to ${people(result.sent)}.`, kind: 'success' }
}

export function SubscribersPage() {
  const confirm = useConfirm()
  const notify = useToast()
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)

  const summary = useAsync(() => api.subscribersSummary(), [])
  const list = useAsync(() => api.subscribers(page), [page])

  async function remove(subscriber: Subscriber) {
    const ok = await confirm({
      title: 'Remove this address?',
      message: <>{subscriber.email} is deleted from the list and will get no more emails. They can subscribe again themselves.</>,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return

    setBusyId(subscriber.id)
    try {
      await api.removeSubscriber(subscriber.id)
      notify('Address removed.')
      summary.reload()
      list.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="Subscribers">
        <button className="btn" onClick={() => { summary.reload(); list.reload() }} disabled={list.loading}>Refresh</button>
      </PageHeader>

      {summary.error && <ErrorNote message={summary.error} onRetry={summary.reload} />}

      {summary.data && !summary.data.emailConfigured && (
        <div className="note note--setup" role="status">
          <span>
            Email is not set up yet, so the public site does not show the subscribe form. Follow “Email subscriptions” in ADMIN.md:
            a free Brevo account, three records on your domain, and two settings on Render.
          </span>
        </div>
      )}

      {summary.data && (
        <div className="tiles">
          <StatTile label="Subscribed" value={formatNumber(summary.data.confirmed)} hint="get your announcements" />
          <StatTile label="Waiting to confirm" value={formatNumber(summary.data.pending)} hint="have not clicked the email link" />
          <StatTile label="Unsubscribed" value={formatNumber(summary.data.unsubscribed)} hint="asked to stop" />
          <StatTile label="Emails per day" value={formatNumber(summary.data.dailyLimit)} hint="the mail service's free allowance" />
        </div>
      )}

      <p className="muted">
        Readers subscribe on the public site and confirm by email. To tell them about a post, use <strong>Notify subscribers</strong> beside it on the Posts page;
        nothing is sent automatically.
      </p>

      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Spinner />}

      {list.data && (list.data.items.length === 0 ? (
        <Empty title="No subscribers yet">Addresses appear here as readers subscribe.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Email</th><th>Status</th><th>Asked on</th><th>Confirmed on</th><th></th></tr>
              </thead>
              <tbody>
                {list.data.items.map((subscriber) => (
                  <tr key={subscriber.id} className={busyId === subscriber.id ? 'is-busy' : undefined}>
                    <td>{subscriber.email}</td>
                    <td><Badge tone={statusTone[subscriber.status]}>{statusLabel[subscriber.status]}</Badge></td>
                    <td>{formatDate(subscriber.createdAt)}</td>
                    <td>{formatDate(subscriber.confirmedAt)}</td>
                    <td className="actions">
                      <button className="btn btn--small btn--danger" onClick={() => remove(subscriber)} disabled={busyId !== null}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted small">{formatNumber(list.data.totalCount)} {list.data.totalCount === 1 ? 'address' : 'addresses'}</p>
          <Pagination page={page} totalPages={list.data.totalPages} onChange={setPage} />
        </>
      ))}
    </>
  )
}
