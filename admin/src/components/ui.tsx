import type { ReactNode } from 'react'
import type { PostStatus } from '../api/types'

/** What each state is called on screen. "Inactive" is the stored name; people read "Not active". */
export const statusLabels: Record<PostStatus, string> = { Draft: 'Draft', Published: 'Published', Inactive: 'Not active' }

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="spinner">{label}</div>
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="note note--error" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn btn--small" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="page-header__actions">{children}</div>
    </header>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="tile">
      <div className="tile__value">{value}</div>
      <div className="tile__label">{label}</div>
      {hint && <div className="tile__hint">{hint}</div>}
    </div>
  )
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Pages">
      <button className="btn btn--small" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="muted">Page {page} of {totalPages}</span>
      <button className="btn btn--small" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  )
}

const number = new Intl.NumberFormat()
export const formatNumber = (value: number) => number.format(value)

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

const publicSite = ((import.meta.env.VITE_PUBLIC_SITE as string | undefined) ?? 'http://localhost:5173').replace(/\/+$/, '')

/** The public address of a post, or null while it has no slug (drafts never do). */
export function publicPostUrl(slug: string | null): string | null {
  return slug ? `${publicSite}/read/${encodeURIComponent(slug)}` : null
}
