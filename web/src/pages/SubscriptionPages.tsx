import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { ErrorNote } from '../components/ui'
import { useTitle } from '../hooks/useTitle'

type Step = 'ask' | 'working' | 'done'

/**
 * Both pages wait for a click before doing anything. Mail services and virus scanners open the
 * links in emails on their own; if opening the link were enough, a scanner could subscribe or
 * unsubscribe someone without their knowing.
 */
function TokenAction({ title, question, button, working, done, action }: {
  title: string
  question: string
  button: string
  working: string
  done: { heading: string; text: string }
  action: (token: string) => Promise<void>
}) {
  useTitle(title)
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [step, setStep] = useState<Step>('ask')
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setStep('working')
    setError(null)
    try {
      await action(token)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.')
      setStep('ask')
    }
  }

  return (
    <main className="main main--reading">
      <div className="card notice">
        {step === 'done' ? (
          <>
            <h1>{done.heading}</h1>
            <p>{done.text}</p>
            <Link className="btn" to="/">Go to the articles</Link>
          </>
        ) : token === '' ? (
          <>
            <h1>{title}</h1>
            <p>This link is incomplete. Open it again from the email, or copy the whole address.</p>
            <Link className="btn" to="/">Go to the articles</Link>
          </>
        ) : (
          <>
            <h1>{title}</h1>
            <p>{question}</p>
            {error && <ErrorNote message={error} />}
            <button className="btn btn--primary" onClick={run} disabled={step === 'working'}>
              {step === 'working' ? working : button}
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export function ConfirmSubscriptionPage() {
  return (
    <TokenAction
      title="Confirm your subscription"
      question="Press the button to start getting an email whenever a new article is published."
      button="Confirm my subscription"
      working="Confirming…"
      done={{ heading: 'You are subscribed', text: 'You will get a short email when a new article is published. Every email has an unsubscribe link.' }}
      action={(token) => api.confirmSubscription(token)}
    />
  )
}

export function UnsubscribePage() {
  return (
    <TokenAction
      title="Unsubscribe"
      question="Press the button to stop getting emails about new articles."
      button="Unsubscribe me"
      working="Unsubscribing…"
      done={{ heading: 'You are unsubscribed', text: 'You will not get any more emails from Articles. You are welcome back any time.' }}
      action={(token) => api.unsubscribe(token)}
    />
  )
}
