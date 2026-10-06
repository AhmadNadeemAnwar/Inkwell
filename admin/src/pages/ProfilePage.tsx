import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { api, assetUrl } from '../api/client'
import type { Profile } from '../api/types'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../components/feedback'
import { ErrorNote, PageHeader, Spinner } from '../components/ui'
import { uploadImage } from '../posts/imageUpload'
import { isWebAddress } from '../posts/sections'

const MAX_BIO = 300
const MAX_NAME = 60

/** The first thing wrong with the form, in words the person can act on, or null. */
export function profileProblem(displayName: string, bio: string, websiteUrl: string): string | null {
  if (displayName.trim() === '') return 'Your name is required.'
  if (displayName.trim().length > MAX_NAME) return `Your name can be at most ${MAX_NAME} characters.`
  if (bio.length > MAX_BIO) return `Your bio can be at most ${MAX_BIO} characters.`
  if (websiteUrl.trim() !== '' && !isWebAddress(websiteUrl)) return 'Your website must start with http:// or https://.'
  return null
}

export function ProfilePage() {
  const profile = useAsync(() => api.profile(), [])

  if (profile.loading && !profile.data) return <Spinner label="Opening your profile…" />
  if (profile.error || !profile.data) {
    return (
      <>
        <PageHeader title="Profile" />
        <ErrorNote message={profile.error ?? 'Your profile could not be loaded.'} onRetry={profile.reload} />
      </>
    )
  }

  return <ProfileForm initial={profile.data} />
}

function ProfileForm({ initial }: { initial: Profile }) {
  const notify = useToast()
  const photoInput = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(initial.displayName)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const snapshot = JSON.stringify({ displayName, bio, avatarUrl, websiteUrl })
  const [baseline, setBaseline] = useState(snapshot)
  const dirty = snapshot !== baseline
  const problem = profileProblem(displayName, bio, websiteUrl)

  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setPhotoBusy(true)
    setError(null)
    try {
      setAvatarUrl((await uploadImage(file)).path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That picture could not be uploaded.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (problem) return

    setSaving(true)
    setError(null)
    try {
      await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        avatarUrl: avatarUrl || null,
        websiteUrl: websiteUrl.trim() || null,
      })
      setBaseline(snapshot)
      notify('Profile saved. It shows on your posts straight away.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile" onSubmit={save}>
      <PageHeader title="Profile" />
      <p className="muted">This is how you appear to readers: beside every post, and on your author page (@{initial.handle}).</p>

      {error && <ErrorNote message={error} />}

      <section className="panel">
        <div className="field">
          <label>Photo</label>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePhoto} />
          <div className="profile__photo">
            {avatarUrl
              ? <img src={assetUrl(avatarUrl)} alt="" />
              : <span className="profile__initial" aria-hidden="true">{(displayName.trim()[0] ?? '?').toUpperCase()}</span>}
            <button type="button" className="btn btn--small" disabled={photoBusy} onClick={() => photoInput.current?.click()}>
              {photoBusy ? 'Uploading…' : avatarUrl ? 'Replace photo' : 'Choose a photo'}
            </button>
            {avatarUrl && <button type="button" className="btn btn--small btn--danger" onClick={() => setAvatarUrl('')}>Remove</button>}
          </div>
          <p className="field__hint">Shown as a small circle, so a square picture of your face works best.</p>
        </div>

        <div className="field">
          <label htmlFor="displayName">Name</label>
          <input id="displayName" value={displayName} maxLength={MAX_NAME} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="bio">Bio (optional)</label>
          <textarea id="bio" rows={3} value={bio} maxLength={MAX_BIO} onChange={(e) => setBio(e.target.value)} />
          <p className="field__hint">{MAX_BIO - bio.length} characters left. One or two sentences about what you write.</p>
        </div>

        <div className="field">
          <label htmlFor="website">Website (optional)</label>
          <input id="website" value={websiteUrl} inputMode="url" placeholder="https://…" onChange={(e) => setWebsiteUrl(e.target.value)} />
        </div>
      </section>

      <div className="actionbar" role="group" aria-label="Profile actions">
        <span className={`muted${dirty ? ' unsaved' : ''}`}>{saving ? 'Saving…' : problem ?? (dirty ? 'Unsaved changes' : 'All changes saved')}</span>
        <span className="spacer" />
        <button className="btn btn--primary" disabled={saving || !dirty || problem !== null}>Save profile</button>
      </div>
    </form>
  )
}
