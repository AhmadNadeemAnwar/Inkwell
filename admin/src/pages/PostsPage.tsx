import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, sessionHandle } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { AdminPost, PostStatus } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useConfirm, useToast } from '../components/feedback'
import { Empty, ErrorNote, PageHeader, Pagination, Spinner, formatDate, formatNumber, publicPostUrl, statusLabels } from '../components/ui'

const STATUSES: PostStatus[] = ['Draft', 'Published', 'Inactive']

export function PostsPage() {
  const confirm = useConfirm()
  const notify = useToast()
  const myHandle = sessionHandle(useAuth().session)

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

  async function changeStatus(post: AdminPost, target: PostStatus) {
    if (target === post.status) return

    const ok = await confirm(
      target === 'Published'
        ? { title: 'Publish this post?', message: <>“{post.title}” goes live on Inkwell straight away{post.slug ? ', at the same address as before' : ''}.</>, confirmLabel: 'Publish' }
        : post.status === 'Published'
          ? {
              title: 'Take this post down?',
              message: <>“{post.title}” comes off the site at once and becomes {statusLabels[target].toLowerCase()}. Nothing is deleted, and it keeps its address for when it is published again.</>,
              confirmLabel: 'Take down',
            }
          : { title: `Change to ${statusLabels[target].toLowerCase()}?`, message: <>“{post.title}” stays hidden from readers either way.</>, confirmLabel: 'Change' },
    )
    if (!ok) return

    await act(post, () => api.adminSetPostStatus(post.id, target), target === 'Published' ? 'Post published.' : `Post is now ${statusLabels[target].toLowerCase()}.`)
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
      <PageHeader title="Posts">
        <Link className="btn btn--primary" to="/posts/new">New post</Link>
      </PageHeader>

      <div className="filters">
        <input type="search" placeholder="Search title or author" aria-label="Search posts" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option value="Published">Published</option>
          <option value="Draft">Drafts</option>
          <option value="Inactive">Not active</option>
        </select>
      </div>

      {posts.error && <ErrorNote message={posts.error} onRetry={posts.reload} />}
      {posts.loading && !posts.data && <Spinner />}

      {posts.data && (posts.data.items.length === 0 ? (
        <Empty title={term || status ? 'No posts match' : 'No posts yet'}>
          {term || status ? 'Try a different search or status.' : <Link className="btn btn--primary" to="/posts/new">Write your first post</Link>}
        </Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th><th>Author</th><th>Status</th><th>Published</th>
                  <th className="num">Views</th><th className="num">Claps</th><th className="num">Insightful</th><th></th>
                </tr>
              </thead>
              <tbody>
                {posts.data.items.map((post) => {
                  const url = publicPostUrl(post.slug)
                  return (
                    <tr key={post.id} className={busyId === post.id ? 'is-busy' : undefined}>
                      <td>
                        <div className="cell-title">{url && post.status === 'Published' ? <a href={url} target="_blank" rel="noopener noreferrer">{post.title}</a> : post.title}</div>
                        {post.tags.length > 0 && <div className="cell-sub">{post.tags.join(' · ')}</div>}
                      </td>
                      <td>@{post.authorHandle}</td>
                      <td>
                        <select className={`status-select status-select--${post.status.toLowerCase()}`} aria-label={`Status of ${post.title}`}
                          value={post.status} disabled={busyId === post.id} onChange={(e) => changeStatus(post, e.target.value as PostStatus)}>
                          {STATUSES.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                        </select>
                      </td>
                      <td>{formatDate(post.publishedAt)}</td>
                      <td className="num">{formatNumber(post.views)}</td>
                      <td className="num">{formatNumber(post.claps)}</td>
                      <td className="num">{formatNumber(post.insightful)}</td>
                      <td className="actions">
                        {post.authorHandle === myHandle && <Link className="btn btn--small" to={`/posts/${post.id}/edit`}>Edit</Link>}
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
