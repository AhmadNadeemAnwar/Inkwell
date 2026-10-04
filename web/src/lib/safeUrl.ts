/**
 * Allow-list checks for URLs that originate from users. Everything is judged by parsing, never by
 * string prefix: "  javascript:..." and "JAVASCRIPT:..." are valid schemes to a browser, and a
 * prefix test such as startsWith('/') lets protocol-relative "//evil.example" through.
 */

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

/** Returns the URL if it may be used as an image source, otherwise undefined. */
export function safeImageSrc(url: string | null | undefined): string | undefined {
  return isHttpsUrl(url) ? url!.trim() : undefined
}
