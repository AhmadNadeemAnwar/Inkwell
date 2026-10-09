import type { Collection, Frontmatter } from '../api/types'

export type FieldKind = 'text' | 'textarea' | 'date' | 'flag' | 'list' | 'url' | 'link' | 'impact'

export interface Field {
  key: string
  label: string
  kind: FieldKind
  required?: boolean
  max?: number
  help?: string
  placeholder?: string
}

/**
 * The form for each collection. This mirrors the rules in the API (which is the authority and
 * re-checks everything) and the schema in the portfolio's content.config.ts; it exists so the form
 * can show the right inputs and catch mistakes before a round trip.
 */
export const schema: Record<Collection, Field[]> = {
  blog: [
    { key: 'title', label: 'Title', kind: 'text', required: true, max: 200 },
    { key: 'description', label: 'Description', kind: 'textarea', required: true, max: 400, help: 'Shown in listings and as the page summary.' },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'tags', label: 'Tags', kind: 'list', max: 10, help: 'Separate with commas. Up to 10.' },
    { key: 'draft', label: 'Draft', kind: 'flag', help: 'Drafts are hidden from the site and the RSS feed.' },
  ],
  projects: [
    { key: 'title', label: 'Title', kind: 'text', required: true, max: 200 },
    { key: 'summary', label: 'Summary', kind: 'textarea', required: true, max: 500, help: 'One or two sentences for the project card.' },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'tech', label: 'Tech', kind: 'list', max: 20, help: 'Separate with commas, e.g. ASP.NET Core, React, SQL.' },
    { key: 'featured', label: 'Featured', kind: 'flag', help: 'Featured projects are highlighted on the home page.' },
    { key: 'impact', label: 'Impact figure', kind: 'impact', help: 'A headline number and what it measures, e.g. 40% / faster builds. Needs both parts, or leave both empty.' },
    { key: 'repo', label: 'Repository link', kind: 'url', max: 500, placeholder: 'https://github.com/…' },
    { key: 'demo', label: 'Live demo link', kind: 'url', max: 500, placeholder: 'https://…' },
    { key: 'draft', label: 'Draft', kind: 'flag', help: 'Drafts are hidden from the site.' },
  ],
  updates: [
    { key: 'title', label: 'Update', kind: 'text', required: true, max: 200, help: 'A short note: “Shipped X”, “Started Y”.' },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'link', label: 'Link', kind: 'link', max: 500, help: 'Optional. A full https:// link, or a path on the site like /portfolio/my-project.', placeholder: 'https://…' },
  ],
}

export const collectionLabels: Record<Collection, string> = { blog: 'Blog', projects: 'Projects', updates: 'Updates' }

// The portfolio no longer has a blog (the writing lives on Articles), so the portal offers only these two.
export const collections: Collection[] = ['projects', 'updates']

export function isCollection(value: string | undefined): value is Collection {
  return value === 'blog' || value === 'projects' || value === 'updates'
}

export interface FormValues {
  text: Record<string, string>
  flags: Record<string, boolean>
  lists: Record<string, string>
  impact: { value: string; label: string }
}

const asText = (value: unknown) => (value === null || value === undefined ? '' : String(value))

/** Turns a loaded entry's front matter into form state. Keys the form does not know are returned separately so a save can keep them. */
export function toForm(collection: Collection, frontmatter: Frontmatter): { values: FormValues; extra: Frontmatter } {
  const values: FormValues = { text: {}, flags: {}, lists: {}, impact: { value: '', label: '' } }
  const known = new Set(schema[collection].map((f) => f.key))

  for (const field of schema[collection]) {
    const raw = frontmatter[field.key]
    if (field.kind === 'flag') values.flags[field.key] = raw === true
    else if (field.kind === 'list') values.lists[field.key] = Array.isArray(raw) ? raw.map(asText).join(', ') : ''
    else if (field.kind === 'impact') {
      const impact = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      values.impact = { value: asText(impact.value), label: asText(impact.label) }
    } else values.text[field.key] = asText(raw)
  }

  const extra: Frontmatter = {}
  for (const [key, value] of Object.entries(frontmatter)) if (!known.has(key)) extra[key] = value

  return { values, extra }
}

export function emptyForm(collection: Collection): FormValues {
  const today = new Date().toISOString().slice(0, 10)
  const { values } = toForm(collection, { date: today })
  return values
}

/** Builds the front matter to send. Empty optional fields are omitted so they are not written as blanks. */
export function fromForm(collection: Collection, values: FormValues, extra: Frontmatter): Frontmatter {
  const result: Frontmatter = { ...extra }

  for (const field of schema[collection]) {
    switch (field.kind) {
      case 'flag':
        result[field.key] = values.flags[field.key] === true
        break
      case 'list':
        result[field.key] = (values.lists[field.key] ?? '').split(',').map((item) => item.trim()).filter(Boolean)
        break
      case 'impact':
        result[field.key] = values.impact.value.trim() || values.impact.label.trim()
          ? { value: values.impact.value.trim(), label: values.impact.label.trim() }
          : null
        break
      default: {
        const text = (values.text[field.key] ?? '').trim()
        result[field.key] = text === '' && !field.required ? null : text
      }
    }
  }

  return result
}

/** Quick checks for the obvious mistakes; the API re-validates everything and has the final say. */
export function problems(collection: Collection, values: FormValues): string[] {
  const found: string[] = []

  for (const field of schema[collection]) {
    if (field.kind === 'flag' || field.kind === 'list') continue
    if (field.kind === 'impact') {
      const { value, label } = values.impact
      if ((value.trim() === '') !== (label.trim() === '')) found.push('Impact needs both a value and a label, or neither.')
      continue
    }

    const text = (values.text[field.key] ?? '').trim()
    if (field.required && !text) found.push(`${field.label} is required.`)
    if (field.max && text.length > field.max) found.push(`${field.label} is longer than ${field.max} characters.`)
    if (text && field.kind === 'url' && !/^https?:\/\/\S+$/i.test(text)) found.push(`${field.label} must start with http:// or https://.`)
    if (text && field.kind === 'link' && !/^(https?:\/\/\S+|\/(?!\/)\S*)$/i.test(text)) found.push(`${field.label} must be an http(s) link or a path starting with /.`)
  }

  return found
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

export const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/
