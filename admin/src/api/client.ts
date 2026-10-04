import type {
  AdminComment, AdminPost, AdminTag, Collection, Frontmatter, Paged, PortfolioEntry, PortfolioStatus,
  PortfolioSummary, Session, Stats,
} from './types'

// Empty in development (Vite proxies /api); the production build bakes in the API's absolute URL.
const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '')

const SESSION_KEY = 'inkwell.admin.session'

/**
 * The session lives in sessionStorage, not localStorage: it disappears when the tab closes, so a
 * forgotten browser does not stay signed in to the admin portal.
 */
export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until the page is reloaded.
  }
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let onSessionLost: (() => void) | null = null

/** Called when the API says the session is no longer valid, so the app can return to the sign-in page. */
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const session = loadSession()

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: { detail?: string; title?: string; errors?: Record<string, string[]> } | null = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    // 401/403 on an authenticated call means the session expired or admin access was removed.
    if (auth && (response.status === 401 || response.status === 403)) onSessionLost?.()

    const message = payload?.errors
      ? Object.values(payload.errors).flat()[0]
      : payload?.detail ?? payload?.title ?? `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }

  return payload as T
}

const query = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  login: (email: string, password: string, code: string) =>
    request<Session>('POST', '/api/v1/admin/auth/login', { email, password, code }, false),

  me: () => request<{ email: string; displayName: string }>('GET', '/api/v1/admin/me'),

  stats: () => request<Stats>('GET', '/api/v1/admin/stats'),

  posts: (params: { status?: string; q?: string; pageNumber?: number; pageSize?: number }) =>
    request<Paged<AdminPost>>('GET', `/api/v1/admin/posts${query(params)}`),
  unpublishPost: (id: string) => request<void>('POST', `/api/v1/admin/posts/${id}/unpublish`),
  deletePost: (id: string) => request<void>('DELETE', `/api/v1/admin/posts/${id}`),

  comments: (pageNumber = 1) => request<Paged<AdminComment>>('GET', `/api/v1/admin/comments${query({ pageNumber, pageSize: 25 })}`),
  deleteComment: (id: string) => request<void>('DELETE', `/api/v1/admin/comments/${id}`),

  tags: () => request<AdminTag[]>('GET', '/api/v1/admin/tags'),
  renameTag: (id: string, name: string) => request<AdminTag>('PUT', `/api/v1/admin/tags/${id}`, { name }),
  mergeTag: (id: string, targetTagId: string) => request<void>('POST', `/api/v1/admin/tags/${id}/merge`, { targetTagId }),
  deleteTag: (id: string) => request<void>('DELETE', `/api/v1/admin/tags/${id}`),

  portfolioStatus: () => request<PortfolioStatus>('GET', '/api/v1/admin/portfolio/status'),
  portfolioList: (collection: Collection) => request<PortfolioSummary[]>('GET', `/api/v1/admin/portfolio/${collection}`),
  portfolioGet: (collection: Collection, slug: string) =>
    request<PortfolioEntry>('GET', `/api/v1/admin/portfolio/${collection}/${encodeURIComponent(slug)}`),
  portfolioSave: (collection: Collection, slug: string, sha: string | null, frontmatter: Frontmatter, body: string) =>
    request<PortfolioEntry>('PUT', `/api/v1/admin/portfolio/${collection}/${encodeURIComponent(slug)}`, { sha, frontmatter, body }),
  portfolioDelete: (collection: Collection, slug: string, sha: string) =>
    request<void>('DELETE', `/api/v1/admin/portfolio/${collection}/${encodeURIComponent(slug)}${query({ sha })}`),
}
