import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { PostStatus } from '../api/types'
import { Editor } from '../components/Editor'
import { TagInput } from '../components/TagInput'
import { ErrorNote, Spinner } from '../components/ui'

const AUTOSAVE_DELAY_MS = 2000
const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}'

export function EditorPage() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()

  const [postId, setPostId] = useState<string | null>(routeId ?? null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [contentJson, setContentJson] = useState(EMPTY_DOC)
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<PostStatus>('Draft')
  const [slug, setSlug] = useState<string | null>(null)

  const [loading, setLoading] = useState(Boolean(routeId))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Suppresses the autosave that would otherwise fire from populating state after a load.
  const hydrating = useRef(true)
  // Snapshot of what was last persisted, so autosave skips when nothing actually changed.
  const lastSaved = useRef<string | null>(null)

  useEffect(() => {
    if (!routeId) {
      hydrating.current = false
      return
    }

    api.postForEdit(routeId)
      .then((post) => {
        setTitle(post.title)
        setSubtitle(post.subtitle ?? '')
        setContentJson(post.contentJson)
        setCoverImageUrl(post.coverImageUrl ?? '')
        setTags(post.tags.map((t) => t.name))
        setStatus(post.status)
        setSlug(post.slug)
        setPostId(post.id)

        // Record what was loaded, so simply opening a draft does not trigger a pointless save.
        lastSaved.current = JSON.stringify({
          title: post.title,
          subtitle: post.subtitle ?? '',
          contentJson: post.contentJson,
          coverImageUrl: post.coverImageUrl ?? '',
          tags: post.tags.map((t) => t.name),
        })
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not open this draft.'))
      .finally(() => {
        setLoading(false)
        // Let the state updates flush before autosave starts watching.
        setTimeout(() => { hydrating.current = false }, 0)
      })
  }, [routeId])

  const snapshot = JSON.stringify({ title, subtitle, contentJson, coverImageUrl, tags })

  /** Persists the draft and returns its id, so callers like publish can act on a just-created post. */
  const save = useCallback(async (): Promise<string | null> => {
    if (!title.trim()) return postId

    setSaving(true)
    setError(null)
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        contentJson,
        coverImageUrl: coverImageUrl.trim() || null,
        tags,
      }

      const post = postId ? await api.updatePost(postId, payload) : await api.createPost(payload)

      lastSaved.current = snapshot
      setPostId(post.id)
      setStatus(post.status)
      setSlug(post.slug)
      setSavedAt(new Date())

      // Put the new id in the URL so a refresh reopens the same draft.
      if (!postId) navigate(`/write/${post.id}`, { replace: true })

      return post.id
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your draft.')
      return postId
    } finally {
      setSaving(false)
    }
  }, [title, subtitle, contentJson, coverImageUrl, tags, postId, navigate, snapshot])

  useEffect(() => {
    if (hydrating.current || loading) return
    if (!title.trim()) return
    if (lastSaved.current === snapshot) return

    const timer = setTimeout(save, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [snapshot, title, loading, save])

  async function publish() {
    const id = await save()
    if (!id) return

    try {
      const post = await api.publishPost(id)
      navigate(`/p/${post.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish this post.')
    }
  }

  async function unpublish() {
    if (!postId) return
    const post = await api.unpublishPost(postId)
    setStatus(post.status)
  }

  async function remove() {
    if (!postId || !window.confirm('Delete this post permanently?')) return
    await api.deletePost(postId)
    navigate('/me/drafts')
  }

  if (loading) return <main className="main main--reading"><Spinner label="Opening draft…" /></main>

  return (
    <main className="main main--reading">
      {error && <ErrorNote message={error} />}

      <input
        className="editor__title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        aria-label="Title"
        maxLength={160}
      />

      <input
        className="editor__subtitle"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="Add a subtitle…"
        aria-label="Subtitle"
        maxLength={300}
      />

      <Editor initialContent={contentJson} onChange={setContentJson} />

      <div className="editor__bar">
        <div style={{ flex: 1, minWidth: '14rem' }}>
          <label className="field__hint" htmlFor="cover">Cover image URL (optional)</label>
          <input
            id="cover"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label className="field__hint">Topics — up to 5, and they are how readers find this</label>
        <TagInput value={tags} onChange={setTags} />
      </div>

      <div className="editor__bar">
        <span className="editor__status">
          {saving ? 'Saving…'
            : savedAt ? `Draft saved ${savedAt.toLocaleTimeString()}`
            : title.trim() ? 'Unsaved' : 'Add a title to start saving'}
        </span>

        <span style={{ flex: 1 }} />

        {status === 'Published' && slug && (
          <>
            <a className="btn" href={`/p/${slug}`}>View</a>
            <button className="btn" onClick={unpublish}>Unpublish</button>
          </>
        )}
        {postId && <button className="btn btn--danger" onClick={remove}>Delete</button>}
        <button className="btn" onClick={save} disabled={saving || !title.trim()}>Save draft</button>
        {status !== 'Published' && (
          <button className="btn btn--primary" onClick={publish} disabled={!title.trim()}>
            Publish
          </button>
        )}
      </div>
    </main>
  )
}
