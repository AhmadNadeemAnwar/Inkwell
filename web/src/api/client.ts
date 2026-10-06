import type {
  AuthResponse, Comment, CurrentUser, Paged, PostDetail, PostSort, PostSummary, Profile, Tag,
} from './types'

const TOKEN_KEY = 'inkwell.token'

// Empty in development, where Vite proxies /api to the local API. In production the SPA and the
// API live on different origins, so the build bakes in the API's absolute URL.
export const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '')

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Carries the HTTP status so callers can distinguish "not found" from "not allowed". */
export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    // The API returns RFC 7807 problem details; validation failures add an `errors` map.
    const message =
      payload?.errors ? Object.values(payload.errors as Record<string, string[]>).flat()[0]
      : payload?.detail ?? payload?.title ?? `Request failed (${response.status})`

    throw new ApiError(message, response.status, payload?.errors)
  }

  return payload as T
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export interface PostFilters {
  q?: string
  tag?: string
  author?: string
  sort?: PostSort
  pageNumber?: number
  pageSize?: number
}

export const api = {
  register: (body: { email: string; handle: string; displayName: string; password: string; turnstileToken?: string }) =>
    request<AuthResponse>('POST', '/api/v1/auth/register', body),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('POST', '/api/v1/auth/login', body),

  me: () => request<CurrentUser>('GET', '/api/v1/auth/me'),

  authOptions: () => request<{ allowPublicSignUp: boolean }>('GET', '/api/v1/auth/options'),

  posts: (filters: PostFilters = {}) =>
    request<Paged<PostSummary>>('GET', `/api/v1/posts${query({ ...filters })}`),

  feed: (pageNumber = 1, pageSize = 20) =>
    request<Paged<PostSummary>>('GET', `/api/v1/posts/feed${query({ pageNumber, pageSize })}`),

  bookmarks: (pageNumber = 1, pageSize = 20) =>
    request<Paged<PostSummary>>('GET', `/api/v1/posts/bookmarks${query({ pageNumber, pageSize })}`),

  post: (slug: string) => request<PostDetail>('GET', `/api/v1/posts/${encodeURIComponent(slug)}`),


  related: (id: string, limit = 4) =>
    request<PostSummary[]>('GET', `/api/v1/posts/${id}/related${query({ limit })}`),


  clap: (id: string, amount = 1) =>
    request<{ postClapCount: number; yourClapCount: number }>('POST', `/api/v1/posts/${id}/claps${query({ amount })}`),

  toggleBookmark: (id: string) =>
    request<{ isActive: boolean }>('POST', `/api/v1/posts/${id}/bookmark`),

  comments: (id: string) => request<Comment[]>('GET', `/api/v1/posts/${id}/comments`),

  addComment: (id: string, body: { body: string; parentId: string | null }) =>
    request<Comment>('POST', `/api/v1/posts/${id}/comments`, body),

  deleteComment: (id: string) => request<void>('DELETE', `/api/v1/comments/${id}`),

  profile: (handle: string) => request<Profile>('GET', `/api/v1/users/${encodeURIComponent(handle)}`),

  updateProfile: (body: { displayName: string; bio: string | null; avatarUrl: string | null; websiteUrl: string | null }) =>
    request<CurrentUser>('PUT', '/api/v1/users/me', body),

  followUser: (handle: string) =>
    request<{ isActive: boolean }>('POST', `/api/v1/users/${encodeURIComponent(handle)}/follow`),

  popularTags: (limit = 20) => request<Tag[]>('GET', `/api/v1/tags${query({ limit })}`),

  suggestTags: (q: string) => request<Tag[]>('GET', `/api/v1/tags/suggest${query({ q })}`),

  followedTags: () => request<Tag[]>('GET', '/api/v1/tags/following'),

  followTag: (slug: string) =>
    request<{ isActive: boolean }>('POST', `/api/v1/tags/${encodeURIComponent(slug)}/follow`),
}
