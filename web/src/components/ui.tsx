import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Author, Tag } from '../api/types'

export function Avatar({ author, large = false }: { author: Pick<Author, 'displayName' | 'avatarUrl'>; large?: boolean }) {
  const initials = author.displayName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  if (author.avatarUrl) {
    return (
      <img
        className={large ? 'avatar avatar--lg' : 'avatar'}
        src={author.avatarUrl}
        alt=""
        style={{ objectFit: 'cover' }}
      />
    )
  }

  return <span className={large ? 'avatar avatar--lg' : 'avatar'} aria-hidden="true">{initials}</span>
}

export function TagPill({ tag }: { tag: Tag }) {
  return <Link className="pill" to={`/tag/${tag.slug}`}>{tag.name}</Link>
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="spinner">{label}</div>
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="alert alert--error" role="alert">{message}</div>
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

/** Absolute date for older posts, relative for recent ones — matches how readers scan a feed. */
export function formatDate(iso: string | null): string {
  if (!iso) return ''

  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays < 1) {
    const hours = Math.floor(diffMs / 3_600_000)
    if (hours < 1) return 'just now'
    return `${hours}h ago`
  }
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}
