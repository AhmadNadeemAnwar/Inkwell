import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorNote } from '../components/ui'
import { Turnstile, turnstileEnabled } from '../components/Turnstile'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="main">
      <form className="form" onSubmit={submit}>
        <h1>Welcome back</h1>
        {error && <ErrorNote message={error} />}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="muted" style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ displayName: '', handle: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  // Tokens are single-use, so a failed attempt needs a fresh widget (and a fresh token).
  const [turnstileKey, setTurnstileKey] = useState(0)

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register({ ...form, turnstileToken: turnstileToken ?? undefined })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
      setTurnstileToken(null)
      setTurnstileKey((key) => key + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="main">
      <form className="form" onSubmit={submit}>
        <h1>Start writing</h1>
        {error && <ErrorNote message={error} />}

        <div className="field">
          <label htmlFor="displayName">Name</label>
          <input id="displayName" value={form.displayName}
            onChange={(e) => update('displayName', e.target.value)} required maxLength={60} />
        </div>

        <div className="field">
          <label htmlFor="handle">Handle</label>
          <input id="handle" value={form.handle} onChange={(e) => update('handle', e.target.value)}
            required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_\-]+" />
          <p className="field__hint">Your profile will live at /@{form.handle || 'your-handle'}</p>
        </div>

        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" autoComplete="email" value={form.email}
            onChange={(e) => update('email', e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="reg-password">Password</label>
          <input id="reg-password" type="password" autoComplete="new-password" value={form.password}
            onChange={(e) => update('password', e.target.value)} required minLength={10} maxLength={128} />
          <p className="field__hint">At least 10 characters. A few random words make a strong password.</p>
        </div>

        {turnstileEnabled && <Turnstile key={turnstileKey} onToken={setTurnstileToken} />}

        <button className="btn btn--primary btn--block" disabled={busy || (turnstileEnabled && !turnstileToken)}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="muted" style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  )
}
