import { useEffect, useId, useState } from 'react'
import { api } from '../api/client'
import type { GeneratedImage, GenerationStatus } from '../api/types'
import { MAX_PROMPT, altFromPrompt, base64ToFile, previewSrc, promptProblem, remainingText } from '../posts/generate'
import { extensionFor, uploadImage } from '../posts/imageUpload'
import { SparkleIcon } from './SparkleIcon'
import { ErrorNote } from './ui'

interface Kept {
  imageId: string
  width: number
  height: number
  /** The description the picture was made from, offered as its text for screen readers. */
  alt: string
}

/** Makes a picture from a description. It is only a preview until Keep is pressed; Keep stores it like any other upload. */
export function GenerateImagePanel({ onKeep, onClose }: { onKeep: (kept: Kept) => void; onClose: () => void }) {
  const promptId = useId()
  const [status, setStatus] = useState<GenerationStatus | null>(null)
  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState<{ image: GeneratedImage; prompt: string } | null>(null)
  const [busy, setBusy] = useState<'generating' | 'saving' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.imageGenerationStatus()
      .then((result) => { if (!cancelled) setStatus(result) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not check whether picture generation is set up.') })
    return () => { cancelled = true }
  }, [])

  const problem = promptProblem(prompt)
  const exhausted = status !== null && status.usedToday >= status.dailyLimit

  async function generate() {
    setBusy('generating')
    setError(null)
    try {
      const image = await api.generateImage(prompt.trim())
      setPreview({ image, prompt: prompt.trim() })
      setStatus((current) => (current ? { ...current, usedToday: image.usedToday, dailyLimit: image.dailyLimit } : current))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The picture could not be made.')
    } finally {
      setBusy(null)
    }
  }

  async function keep() {
    if (!preview) return
    setBusy('saving')
    setError(null)
    try {
      const file = base64ToFile(preview.image.imageBase64, preview.image.contentType, `generated.${extensionFor(preview.image.contentType)}`)
      const stored = await uploadImage(file)
      onKeep({ imageId: stored.id, width: stored.width, height: stored.height, alt: altFromPrompt(preview.prompt) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That picture could not be saved.')
      setBusy(null)
    }
  }

  return (
    <div className="generate" role="region" aria-label="Generate a picture">
      {error && <ErrorNote message={error} />}

      {status && !status.enabled ? (
        <p className="field__hint">
          Picture generation is not set up yet. It needs a free Cloudflare token; the steps are in ADMIN.md under
          &ldquo;Picture generation&rdquo;.
        </p>
      ) : (
        <>
          <div className="field">
            <label htmlFor={promptId}>Describe the picture</label>
            <textarea id={promptId} rows={3} value={prompt} maxLength={MAX_PROMPT} disabled={busy !== null}
              placeholder="For example: a lighthouse on a cliff at dusk, watercolour"
              onChange={(e) => setPrompt(e.target.value)} />
            <p className="field__hint">
              Made by Cloudflare&rsquo;s free FLUX model. Your description is sent to Cloudflare. Nothing is stored until you keep a picture.
              {status && <> {remainingText(status.usedToday, status.dailyLimit)}</>}
            </p>
          </div>

          {preview && (
            <img className="section__image generate__preview" alt={`Generated picture: ${preview.prompt}`}
              src={previewSrc(preview.image.imageBase64, preview.image.contentType)} />
          )}

          <div className="generate__actions">
            {preview && (
              <button type="button" className="btn btn--small btn--primary" disabled={busy !== null} onClick={keep}>
                {busy === 'saving' ? 'Saving…' : 'Keep this picture'}
              </button>
            )}
            <button type="button" className="btn btn--small" disabled={busy !== null || problem !== null || exhausted || status === null} onClick={generate}>
              <SparkleIcon />
              {busy === 'generating' ? 'Making the picture… this can take up to half a minute' : preview ? 'Try again' : 'Generate'}
            </button>
            <button type="button" className="btn btn--small" disabled={busy !== null} onClick={onClose}>Cancel</button>
          </div>
        </>
      )}

      {status && !status.enabled && (
        <div className="generate__actions">
          <button type="button" className="btn btn--small" onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  )
}
