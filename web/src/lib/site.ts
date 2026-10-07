export const SITE_NAME = 'Inkwell'

/**
 * The owner's main site. Empty until that site is reachable: the link, and the contact line on the
 * privacy page, appear only when this is set (VITE_PORTFOLIO_URL in .env.production), so readers are
 * never sent to an address that does not load.
 */
export const PORTFOLIO_URL = normalise(import.meta.env.VITE_PORTFOLIO_URL as string | undefined)

export function normalise(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '')
  if (trimmed === '') return null
  try {
    return new URL(trimmed).protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}

/** What the browser tab and history show: the page first, the site second. */
export function pageTitle(page?: string | null): string {
  const clean = (page ?? '').replace(/\s+/g, ' ').trim()
  return clean === '' ? SITE_NAME : `${clean} · ${SITE_NAME}`
}

/** Where a post is read. Posts used to live under /p/; those addresses still open the same post. */
export function postPath(slug: string | null): string {
  return `/read/${encodeURIComponent(slug ?? '')}`
}
