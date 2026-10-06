import { useParams } from 'react-router-dom'
import { PagedPostList } from '../components/PostCard'
import { usePagedPosts } from '../hooks/usePagedPosts'

export function TagPage() {
  const { slug = '' } = useParams()
  const list = usePagedPosts({ tag: slug }, [slug], `#${slug}`)

  return (
    <main className="main">
      <h1 style={{ fontFamily: 'var(--font-read)', margin: '0 0 1.5rem' }}>#{slug}</h1>
      <PagedPostList list={list} emptyLabel="No posts on this topic yet." />
    </main>
  )
}
