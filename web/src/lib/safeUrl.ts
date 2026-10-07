/**
 * Allow-list checks for URLs that originate from users. Everything is judged by parsing, never by
 * string prefix: "  javascript:..." and "JAVASCRIPT:..." are valid schemes to a browser, and a
 * prefix test such as startsWith('/') lets protocol-relative "//evil.example" through.
 */

const IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STORED_IMAGE_PATH = /^\/api\/v1\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** The id of a picture uploaded to this site. Checked before it is put in an address, so it can only ever name a picture. */
export function isImageId(value: string | null | undefined): value is string {
  return typeof value === 'string' && IMAGE_ID.test(value)
}

/**
 * Where the browser fetches an uploaded picture from: this site's own /media/ address. Cloudflare
 * keeps a copy there, so pictures stay fast even while the API is waking up.
 */
export function storedImageUrl(imageId: string): string {
  return `/media/${imageId.toLowerCase()}`
}

function parse(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    return new URL(url.trim())
  } catch {
    return null
  }
}

/** http(s) only: safe to use as a link target. */
export function isHttpUrl(url: string | null | undefined): boolean {
  const parsed = parse(url)
  return parsed !== null && (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname !== ''
}

/** https only: required for images, since the site is served over https and the CSP only allows https images. */
export function isHttpsUrl(url: string | null | undefined): boolean {
  const parsed = parse(url)
  return parsed !== null && parsed.protocol === 'https:' && parsed.hostname !== ''
}

/** Links inside post bodies may also be mailto: or a path on this site (but never protocol-relative). */
export function isSafeLink(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim()

  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) return true

  const parsed = parse(trimmed)
  return parsed !== null && (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:')
}

/** Returns the URL if it may be used as an href, otherwise undefined so the element renders without a target. */
export function safeHref(url: string | null | undefined): string | undefined {
  return isHttpUrl(url) ? url!.trim() : undefined
}

/**
 * Returns an address that may be used as an image source, otherwise undefined: a picture uploaded
 * to this site (stored as a path on the API), or an https link elsewhere.
 */
export function safeImageSrc(url: string | null | undefined): string | undefined {
  const stored = url ? STORED_IMAGE_PATH.exec(url.trim()) : null
  if (stored) return storedImageUrl(stored[1])

  return isHttpsUrl(url) ? url!.trim() : undefined
}
