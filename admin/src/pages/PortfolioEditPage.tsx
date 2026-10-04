import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ApiError, api } from '../api/client'
import type { Collection, Frontmatter, PortfolioEntry } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useConfirm, useToast } from '../components/feedback'
import { ErrorNote, PageHeader, Spinner } from '../components/ui'
import {
  collectionLabels, emptyForm, fromForm, isCollection, problems, schema, slugPattern, slugify, toForm,
} from '../portfolio/schema'
import type { Field, FormValues } from '../portfolio/schema'

export function PortfolioEditPage() {
  const { collection, slug } = useParams()
  if (!isCollection(collection)) return <Navigate to="/portfolio/projects" replace />

  // Remounting on a different entry resets the form completely, so state can never leak between entries.
  return <Loader key={`${collection}/${slug ?? '_new'}`} collection={collection} slug={slug} />
}

function Loader({ collection, slug }: { collection: Collection; slug: string | undefined }) {
  const entry = useAsync(() => (slug ? api.portfolioGet(collection, slug) : Promise.resolve(null)), [collection, slug])

  if (entry.loading && !entry.data && slug) return <Spinner label="Opening entry…" />
  if (entry.error) {
    return (
      <>
        <PageHeader title="Entry" />
        <ErrorNote message={entry.error} onRetry={entry.reload} />
        <p><Link to={`/portfolio/${collection}`}>Back to {collectionLabels[collection]}</Link></p>
      </>
    )
  }

  return <EditorForm collection={collection} slug={slug} initial={entry.data} />
}

function EditorForm({ collection, slug: initialSlug, initial }: { collection: Collection; slug: string | undefined; initial: PortfolioEntry | null }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const notify = useToast()
  const creating = initial === null

  const start = useMemo(() => (initial ? toForm(collection, initial.frontmatter) : { values: emptyForm(collection), extra: {} as Frontmatter }), [collection, initial])

  const [values, setValues] = useState<FormValues>(start.values)
  const [extra] = useState<Frontmatter>(start.extra)
  const [body, setBody] = useState(initial?.body ?? '')
  const [slug, setSlug] = useState(initialSlug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [sha, setSha] = useState<string | null>(initial?.sha ?? null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  const snapshot = JSON.stringify({ values, body, slug })
  const [baseline, setBaseline] = useState(snapshot)
  const dirty = snapshot !== baseline

  // The browser's own prompt guards against closing the tab or reloading with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  function setText(key: string, value: string) {
    setValues((current) => ({ ...current, text: { ...current.text, [key]: value } }))
    // A new entry's file name follows its title until the author chooses one.
    if (creating && key === 'title' && !slugTouched) setSlug(slugify(value))
  }

  async function save() {
    setError(null)
    setConflict(false)

    const issues = problems(collection, values)
    if (!slugPattern.test(slug)) issues.push('The file name may only use lowercase letters, numbers and hyphens, and cannot start or end with a hyphen.')
    if (issues.length > 0) { setError(issues.join(' ')); return }

    setSaving(true)
    try {
      const saved = await api.portfolioSave(collection, slug, sha, fromForm(collection, values, extra), body)
      setSha(saved.sha)
      setBaseline(snapshot)
      notify('Saved. The site rebuilds in about a minute.')
      if (creating) navigate(`/portfolio/${collection}/${slug}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true)
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete this entry?',
      message: <>“{values.text.title || slug}” will be removed from the repository and the site. It stays in git history, so it can be recovered from GitHub.</>,
      confirmLabel: 'Delete entry',
      danger: true,
    })
    if (!ok || !sha) return

    setSaving(true)
    try {
      await api.portfolioDelete(collection, slug, sha)
      setBaseline(snapshot)
      notify('Deleted. The site rebuilds in about a minute.')
      navigate(`/portfolio/${collection}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
      setSaving(false)
    }
  }

  async function leave() {
    if (dirty) {
      const ok = await confirm({ title: 'Discard your changes?', message: 'You have edits that have not been saved.', confirmLabel: 'Discard', danger: true })
      if (!ok) return
    }
    navigate(`/portfolio/${collection}`)
  }

  const title = values.text.title?.trim() || (creating ? 'New entry' : slug)

  return (
    <>
      <PageHeader title={`${collectionLabels[collection]}: ${title}`}>
        <button className="btn" onClick={leave}>Back to list</button>
      </PageHeader>

      {error && (
        <ErrorNote message={error} onRetry={conflict ? () => navigate(0) : undefined} />
      )}

      <section className="panel form-grid">
        {schema[collection].map((field) => (
          <FieldInput key={field.key} field={field} values={values} setValues={setValues} setText={setText} />
        ))}

        <div className="field">
          <label htmlFor="slug">File name</label>
          <div className="slug-row">
            <input
              id="slug"
              value={slug}
              disabled={!creating}
              onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true) }}
              placeholder="my-new-entry"
              maxLength={80}
            />
            <span className="muted">.md</span>
          </div>
          <p className="field__hint">
            {creating ? 'Chosen once and then fixed: it is the entry’s address and cannot be changed later.' : 'Fixed, because it is part of the entry’s address.'}
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="tabs tabs--inline" role="tablist" aria-label="Content view">
          <button role="tab" aria-selected={tab === 'write'} className={`tab${tab === 'write' ? ' tab--active' : ''}`} onClick={() => setTab('write')}>Write</button>
          <button role="tab" aria-selected={tab === 'preview'} className={`tab${tab === 'preview' ? ' tab--active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
        </div>

        {tab === 'write' ? (
          <textarea
            className="editor"
            aria-label="Markdown content"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={26}
            spellCheck
            placeholder="Write in Markdown…"
          />
        ) : (
          <article className="preview">
            {body.trim() ? <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown> : <p className="muted">Nothing to preview yet.</p>}
          </article>
        )}
      </section>

      <div className="actionbar" role="group" aria-label="Entry actions">
        <span className={`muted${dirty ? ' unsaved' : ''}`}>{saving ? 'Working…' : dirty ? 'Unsaved changes' : creating ? 'Not saved yet' : 'All changes saved'}</span>
        <span className="spacer" />
        {!creating && <button className="btn btn--danger" onClick={remove} disabled={saving}>Delete</button>}
        <button className="btn btn--primary" onClick={save} disabled={saving || (!creating && !dirty)}>{saving ? 'Saving…' : creating ? 'Create and publish' : 'Save'}</button>
      </div>
    </>
  )
}

function FieldInput({ field, values, setValues, setText }: {
  field: Field
  values: FormValues
  setValues: React.Dispatch<React.SetStateAction<FormValues>>
  setText: (key: string, value: string) => void
}) {
  const id = `f-${field.key}`
  const label = <label htmlFor={id}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
  const hint = field.help ? <p className="field__hint">{field.help}</p> : null

  switch (field.kind) {
    case 'flag':
      return (
        <div className="field field--check">
          <label htmlFor={id}>
            <input id={id} type="checkbox" checked={values.flags[field.key] === true}
              onChange={(e) => setValues((c) => ({ ...c, flags: { ...c.flags, [field.key]: e.target.checked } }))} />
            {field.label}
          </label>
          {hint}
        </div>
      )

    case 'list':
      return (
        <div className="field">
          {label}
          <input id={id} value={values.lists[field.key] ?? ''} placeholder="one, two, three"
            onChange={(e) => setValues((c) => ({ ...c, lists: { ...c.lists, [field.key]: e.target.value } }))} />
          {hint}
        </div>
      )

    case 'impact':
      return (
        <div className="field">
          <label htmlFor={`${id}-value`}>{field.label}</label>
          <div className="impact-row">
            <input id={`${id}-value`} placeholder="40%" maxLength={40} aria-label="Impact value" value={values.impact.value}
              onChange={(e) => setValues((c) => ({ ...c, impact: { ...c.impact, value: e.target.value } }))} />
            <input placeholder="faster builds" maxLength={80} aria-label="Impact label" value={values.impact.label}
              onChange={(e) => setValues((c) => ({ ...c, impact: { ...c.impact, label: e.target.value } }))} />
          </div>
          {hint}
        </div>
      )

    case 'textarea':
      return (
        <div className="field field--wide">
          {label}
          <textarea id={id} rows={3} maxLength={field.max} value={values.text[field.key] ?? ''} onChange={(e) => setText(field.key, e.target.value)} />
          {hint}
        </div>
      )

    default:
      return (
        <div className="field">
          {label}
          <input
            id={id}
            type={field.kind === 'date' ? 'date' : 'text'}
            maxLength={field.max}
            placeholder={field.placeholder}
            value={values.text[field.key] ?? ''}
            onChange={(e) => setText(field.key, e.target.value)}
          />
          {hint}
        </div>
      )
  }
}
