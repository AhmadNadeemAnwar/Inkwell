import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { api } from '../api/client'
import type { Tag } from '../api/types'

const MAX_TAGS = 5

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
}

/** Tag picker with type-ahead against existing topics; unmatched entries create a new tag on save. */
export function TagInput({ value, onChange }: Props) {
  const [term, setTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trimmed = term.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      return
    }

    // Debounced so each keystroke does not fire a request.
    const timer = setTimeout(() => {
      api.suggestTags(trimmed)
        .then((tags) => setSuggestions(tags.filter((t) => !value.includes(t.name))))
        .catch(() => setSuggestions([]))
    }, 200)

    return () => clearTimeout(timer)
  }, [term, value])

  function add(name: string) {
    const clean = name.trim()
    if (!clean || value.length >= MAX_TAGS) return
    if (value.some((t) => t.toLowerCase() === clean.toLowerCase())) return

    onChange([...value, clean])
    setTerm('')
    setSuggestions([])
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(term)
    } else if (event.key === 'Backspace' && term === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="taginput" ref={containerRef}>
      <div className="taginput__field">
        {value.map((tag) => (
          <span className="taginput__chip" key={tag}>
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
              ×
            </button>
          </span>
        ))}
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length >= MAX_TAGS ? 'Tag limit reached' : 'Add a topic…'}
          disabled={value.length >= MAX_TAGS}
          aria-label="Add a topic"
        />
      </div>

      {suggestions.length > 0 && (
        <div className="taginput__menu">
          {suggestions.slice(0, 6).map((tag) => (
            <button className="taginput__option" type="button" key={tag.id} onClick={() => add(tag.name)}>
              {tag.name} <span className="faint">· {tag.postCount} posts</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
