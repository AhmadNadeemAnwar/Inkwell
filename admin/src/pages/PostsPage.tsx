import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AdminPost, PostStatus } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useConfirm, useToast } from '../components/feedback'
import { Badge, Empty, ErrorNote, PageHeader, Pagination, Spinner, formatDate, formatNumber, publicPostUrl } from '../components/ui'

const toneFor: Record<PostStatus, 'good' | 'neutral' | 'info'> = { Published: 'good', Draft: 'neutral', Unlisted: 'info' }

export function PostsPage() {
  const confirm = useConfirm()
  const notify = useToast()

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Wait for a pause in typing before searching, so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => { setTerm(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const posts = useAsync(() => api.posts({ status, q: term, pageNumber: page, pageSize: 20 }), [status, term, page])

  async function takeDown(post: AdminPost) {
    const ok = await confirm({
      title: 'Take this post down?',
      message: <>“{post.title}” goes back to a draft and disappears from the site. Nothing is deleted; its author can publish it again.</>,
      confirmLabel: 'Take down',
    })
    if (!ok) return

    await act(post, () => api.unpublishPost(post.id), 'Post taken down.')
  }

  async function remove(post: AdminPost) {
    const ok = await confirm({
      title: 'Delete this post for good?',
      message: <>“{post.title}” and all {formatNumber(post.comments)} of its comments will be permanently deleted. This cannot be undone.</>,
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return

    await act(post, () => api.deletePost(post.id), 'Post deleted.')
  }

  async function act(post: AdminPost, action: () => Promise<void>, success: string) {
    setBusyId(post.id)
    try {
      await action()
      notify(success)
      posts.reload()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="Posts" />

      <div className="filters">
        <input type="search" placeholder="Search title or author" aria-label="Search posts" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option value="Published">Published</option>
          <option value="Draft">Drafts</option>
          <option value="Unlisted">Unlisted</option>
        </select>
      </div>

      {posts.error && <ErrorNote message={posts.error} onRetry={posts.reload} />}
      {posts.loading && !posts.data && <Spinner />}

      {posts.data && (posts.data.items.length === 0 ? (
        <Empty title="No posts match">Try a different search or status.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th><th>Author</th><th>Status</th><th>Published</th>
                  <th className="num">Views</th><th className="num">Claps</th><th className="num">Replies</th><th></th>
                </tr>
              </thead>
              <tbody>
                {posts.data.items.map((post) => {
                  const url = publicPostUrl(post.slug)
                  return (
                    <tr key={post.id} className={busyId === post.id ? 'is-busy' : undefined}>
                      <td>
                        <div className="cell-title">{url && post.status !== 'Draft' ? <a href={url} target="_blank" rel="noopener noreferrer">{post.title}</a> : post.title}</div>
                        {post.tags.length > 0 && <div className="cell-sub">{post.tags.join(' · ')}</div>}
                      </td>
                      <td>@{post.authorHandle}</td>
                      <td><Badge tone={toneFor[post.status]}>{post.status}</Badge></td>
                      <td>{formatDate(post.publishedAt)}</td>
                      <td className="num">{formatNumber(post.views)}</td>
                      <td className="num">{formatNumber(post.claps)}</td>
                      <td className="num">{formatNumber(post.comments)}</td>
                      <td className="actions">
                        {post.status !== 'Draft' && <button className="btn btn--small" onClick={() => takeDown(post)} disabled={busyId === post.id}>Take down</button>}
                        <button className="btn btn--small btn--danger" onClick={() => remove(post)} disabled={busyId === post.id}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="muted small">{formatNumber(posts.data.totalCount)} {posts.data.totalCount === 1 ? 'post' : 'posts'}</p>
          <Pagination page={page} totalPages={posts.data.totalPages} onChange={setPage} />
        </>
      ))}
    </>
  )
}
