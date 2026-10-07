import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

/**
 * Why an address cannot be used, or null if it looks usable. Deliberately light: the confirmation
 * email is what really proves an address, so this only catches slips of the keyboard.
 */
export function emailProblem(value: string): string | null {
  const email = value.trim()
  if (email === '') return 'Enter your email address.'
  if (email.length > 254) return 'That email address is too long.'
  if (/\s/.test(email)) return 'An email address has no spaces in it.'
  if (!/^[^@]+@[^@]+\.[^@.]+$/.test(email) || email.includes('..')) return 'That does not look like an email address.'
  return null
}

/** Asks for an address and sends a confirmation email. Nobody is subscribed until they click the link in it. */
export function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = emailProblem(email)
    if (problem) return setError(problem)

    setBusy(true)
    setError(null)
    try {
      await api.subscribe(email.trim())
      setSentTo(email.trim())
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="subscribe" role="status">
        <strong>Check your inbox.</strong>
        <p>We sent a link to {sentTo}. Click it to confirm, and you will get a short email when a new article is published.</p>
      </div>
    )
  }

  return (
    <form className="subscribe" onSubmit={submit} noValidate>
      <label htmlFor="subscribe-email"><strong>Get new articles by email</strong></label>
      <div className="subscribe__row">
        <input
          id="subscribe-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(null) }}
          aria-invalid={error !== null}
          aria-describedby={error ? 'subscribe-error' : 'subscribe-note'}
        />
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Sending…' : 'Subscribe'}</button>
      </div>
      {error
        ? <p id="subscribe-error" className="subscribe__error" role="alert">{error}</p>
        : <p id="subscribe-note" className="subscribe__note">One email per new article. Unsubscribe with one click. <Link to="/privacy">Privacy</Link></p>}
    </form>
  )
}
