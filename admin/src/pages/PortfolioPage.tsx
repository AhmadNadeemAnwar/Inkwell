import { Link, Navigate, NavLink, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAsync } from '../hooks/useAsync'
import { Badge, Empty, ErrorNote, PageHeader, Spinner, formatDate } from '../components/ui'
import { collectionLabels, collections, isCollection } from '../portfolio/schema'

export function PortfolioPage() {
  const { collection } = useParams()
  const status = useAsync(() => api.portfolioStatus(), [])

  if (!isCollection(collection)) return <Navigate to="/portfolio/projects" replace />

  return (
    <>
      <PageHeader title="Portfolio">
        <Link className="btn btn--primary" to={`/portfolio/${collection}/_new`}>New entry</Link>
      </PageHeader>

      <div className="tabs" role="tablist" aria-label="Collections">
        {collections.map((name) => (
          <NavLink key={name} to={`/portfolio/${name}`} role="tab" className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}>
            {collectionLabels[name]}
          </NavLink>
        ))}
      </div>

      {status.loading && !status.data && <Spinner />}
      {status.error && <ErrorNote message={status.error} onRetry={status.reload} />}

      {status.data && !status.data.configured && <SetupHelp />}

      {status.data?.configured && (
        <>
          <p className="muted small">
            Editing <code>{status.data.repo}</code> on <code>{status.data.branch}</code>. Every save is a commit, and Cloudflare rebuilds the site about a minute later.
          </p>
          <EntryList collection={collection} />
        </>
      )}
    </>
  )
}

function EntryList({ collection }: { collection: 'blog' | 'projects' | 'updates' }) {
  const entries = useAsync(() => api.portfolioList(collection), [collection])

  if (entries.loading && !entries.data) return <Spinner label="Reading the repository…" />
  if (entries.error) return <ErrorNote message={entries.error} onRetry={entries.reload} />
  if (!entries.data) return null

  if (entries.data.length === 0) {
    return (
      <Empty title={`No ${collectionLabels[collection].toLowerCase()} entries yet`}>
        <Link className="btn btn--primary" to={`/portfolio/${collection}/_new`}>Write the first one</Link>
      </Empty>
    )
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Title</th><th>File</th><th>Date</th><th>State</th><th></th></tr></thead>
        <tbody>
          {entries.data.map((entry) => (
            <tr key={entry.slug}>
              <td className="cell-title">{entry.title}</td>
              <td className="muted"><code>{entry.fileName}</code></td>
              <td>{formatDate(entry.date)}</td>
              <td>
                {entry.problem ? <Badge tone="bad">needs attention</Badge> : entry.draft ? <Badge>draft</Badge> : <Badge tone="good">live</Badge>}
                {entry.problem && <div className="cell-sub">{entry.problem}</div>}
              </td>
              <td className="actions">
                {!entry.problem && <Link className="btn btn--small" to={`/portfolio/${collection}/${entry.slug}`}>Edit</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SetupHelp() {
  return (
    <section className="panel">
      <h2>Connect the portfolio repository</h2>
      <p>Editing needs access to the GitHub repository that holds your portfolio. Add these environment variables to the API on Render, then let it redeploy:</p>
      <table className="table table--tight">
        <tbody>
          <tr><td><code>Portfolio__Repo</code></td><td>your repository as <code>owner/name</code></td></tr>
          <tr><td><code>Portfolio__Token</code></td><td>a fine-grained GitHub token for that one repository with <strong>Contents: Read and write</strong></td></tr>
          <tr><td><code>Portfolio__Branch</code></td><td>optional, defaults to <code>main</code></td></tr>
        </tbody>
      </table>
      <p className="muted small">The full steps are in ADMIN.md. Never paste the token anywhere except Render’s settings.</p>
    </section>
  )
}
