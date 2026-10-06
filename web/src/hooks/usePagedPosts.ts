import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { PostFilters } from '../api/client'
import type { PostSummary } from '../api/types'
import { useTitle } from './useTitle'

export const PAGE_SIZE = 20

/**
 * Adds a further page to the posts already shown. A post published while someone is reading pushes
 * every later post down one place, so the next page can repeat one already on screen: repeats are dropped.
 */
export function mergePosts(shown: PostSummary[], next: PostSummary[]): PostSummary[] {
  const seen = new Set(shown.map((post) => post.id))
  return [...shown, ...next.filter((post) => !seen.has(post.id))]
}

interface PagedPosts {
  posts: PostSummary[]
  totalCount: number | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
}

/**
 * A list of posts that grows with a "Load more" button. Changing any of `deps` starts again from the
 * first page. A response that arrives after the list has been restarted is ignored.
 */
export function usePagedPosts(filters: PostFilters | null, deps: unknown[], title?: string | null): PagedPosts {
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(filters !== null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useTitle(title)

  // Identifies the current list. Bumped on every restart so late answers for an old list are dropped.
  const run = useRef(0)

  useEffect(() => {
    const current = ++run.current
    setPosts([])
    setTotalCount(null)
    setPage(1)
    setHasMore(false)
    setError(null)
    setLoadingMore(false)

    if (filters === null) {
      setLoading(false)
      return
    }

    setLoading(true)
    api.posts({ ...filters, pageNumber: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (run.current !== current) return
        setPosts(result.items)
        setTotalCount(result.totalCount)
        setHasMore(result.hasNextPage)
      })
      .catch((err: unknown) => {
        if (run.current === current) setError(err instanceof Error ? err.message : 'Something went wrong.')
      })
      .finally(() => {
        if (run.current === current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const loadMore = useCallback(() => {
    if (filters === null || loadingMore || !hasMore) return
    const current = run.current
    const next = page + 1

    setLoadingMore(true)
    setError(null)
    api.posts({ ...filters, pageNumber: next, pageSize: PAGE_SIZE })
      .then((result) => {
        if (run.current !== current) return
        setPosts((shown) => mergePosts(shown, result.items))
        setTotalCount(result.totalCount)
        setHasMore(result.hasNextPage)
        setPage(next)
      })
      .catch((err: unknown) => {
        if (run.current === current) setError(err instanceof Error ? err.message : 'Could not load more posts.')
      })
      .finally(() => {
        if (run.current === current) setLoadingMore(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters === null, loadingMore, hasMore, page, ...deps])

  return { posts, totalCount, loading, loadingMore, error, hasMore, loadMore }
}
