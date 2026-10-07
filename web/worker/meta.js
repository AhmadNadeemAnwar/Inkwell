// Pure helpers for the Cloudflare program in front of the public site (see index.js). Nothing here
// touches the network, so every rule can be unit tested.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const STORED_IMAGE = new RegExp(`^/api/v1/images/(${UUID})$`, 'i')
const MEDIA_PATH = new RegExp(`^/media/(${UUID})$`, 'i')
const IMAGE_ID = new RegExp(`^${UUID}$`, 'i')

/** The only kinds of file the picture address will ever serve, whatever the API answers with. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** How long a remembered preview is used before it is checked against the API again in the background. */
export const PREVIEW_FRESH_MS = 5 * 60 * 1000
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/

export const DESCRIPTION_LENGTH = 200

/** A person is waiting for the page, so the preview gets only a moment before the page is sent without it. */
export const READER_TIMEOUT_MS = 2500

/** Nobody is waiting on a preview fetcher or crawler, and the preview is the whole reason it came. */
export const FETCHER_TIMEOUT_MS = 20000

const FETCHERS = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|skype|pinterest|vkshare|redditbot|twitter|linkedin/i

/**
 * How long to wait for the API before sending a post page without its preview. The API sleeps when
 * idle and can take a while to wake, so services that fetch a link to build a preview card are
 * given much longer than a reader would tolerate.
 */
export function timeoutFor(userAgent) {
  return FETCHERS.test(String(userAgent ?? '')) ? FETCHER_TIMEOUT_MS : READER_TIMEOUT_MS
}

/** Text placed inside HTML or XML, whether between tags or inside a quoted attribute. */
export function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Characters XML does not allow at all would make a feed reader reject the whole file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/**
 * The post address in a URL path, or null if it is not shaped like one (so it is never sent to the
 * API). Posts are read at /read/<post>; /p/<post> is where they used to live and still opens them.
 */
export function slugFromPath(pathname) {
  const match = /^\/(?:read|p)\/([^/]+)\/?$/.exec(pathname)
  if (!match) return null
  let slug
  try {
    slug = decodeURIComponent(match[1])
  } catch {
    return null
  }
  return SLUG.test(slug) ? slug : null
}

/** The picture id in a /media/<id> address, or null if the address is not exactly that shape. */
export function mediaIdFromPath(pathname) {
  const match = MEDIA_PATH.exec(pathname)
  return match ? match[1].toLowerCase() : null
}

/** Where an old /p/<post> address should send people, or null if the path is not one. */
export function oldPostRedirect(pathname) {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname)
  if (!match) return null
  const slug = slugFromPath(pathname)
  return slug ? `/read/${slug}` : null
}

/** The first picture inside a post body, used for the preview when the post has no cover. */
export function firstImageId(contentJson) {
  let root
  try {
    root = JSON.parse(contentJson)
  } catch {
    return null
  }
  const sections = root && Array.isArray(root.content) ? root.content : []
  for (const section of sections) {
    const id = section && section.type === 'imageSection' ? section.attrs?.imageId : null
    if (typeof id === 'string' && IMAGE_ID.test(id)) return id.toLowerCase()
  }
  return null
}

/** True once a remembered preview is old enough to be checked again. Anything without a readable time counts as old. */
export function isStale(fetchedAt, now = Date.now()) {
  const at = typeof fetchedAt === 'number' ? fetchedAt : NaN
  return !(now - at < PREVIEW_FRESH_MS)
}

/** The words of a stored post body, in order, with formatting dropped. Picture captions are left out: they label a picture, they are not the article. */
export function plainText(contentJson) {
  let root
  try {
    root = JSON.parse(contentJson)
  } catch {
    return ''
  }

  const parts = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.content)) {
      node.content.forEach(walk)
      // Blocks are separate sentences, not one run-on word.
      parts.push(' ')
    }
  }
  walk(root)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

/** Shortens text at a word boundary. */
export function summarise(text, max = DESCRIPTION_LENGTH) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}

/**
 * A picture address a preview may use: one uploaded to this site (served from the site's own
 * /media/ address, which Cloudflare keeps a copy of), or an https link. Anything else is dropped.
 */
export function absoluteImage(value, siteOrigin) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const trimmed = value.trim()
  const stored = STORED_IMAGE.exec(trimmed)
  if (stored) return `${siteOrigin}/media/${stored[1].toLowerCase()}`
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/** The logo card shown when a shared link has no picture. A file in web/public. */
export const DEFAULT_SHARE_IMAGE = '/inkwell-share.png'

/** What a shared link to a post should show. */
export function describePost(post, { siteName, siteOrigin }) {
  // The cover if there is one, otherwise the first picture in the article.
  const inArticle = firstImageId(post.contentJson)
  // With no picture of its own, a post is shared with the site's logo card instead of a bare text preview.
  const image = absoluteImage(post.coverImageUrl, siteOrigin) ?? (inArticle ? `${siteOrigin}/media/${inArticle}` : `${siteOrigin}${DEFAULT_SHARE_IMAGE}`)
  const description = summarise(post.subtitle || plainText(post.contentJson) || `An article on ${siteName}.`)
  return {
    title: `${post.title} · ${siteName}`,
    heading: post.title,
    description,
    // Always the /read/ address, so a post shared through an old /p/ link is still treated as one page.
    url: `${siteOrigin}/read/${post.slug}`,
    image,
    author: post.author?.displayName ?? null,
    publishedAt: post.publishedAt ?? null,
  }
}

/** The tags added to the page's head. Every value is escaped; nothing from a post reaches the page as markup. */
export function headTags(meta, siteName) {
  const tag = (attribute, name, content) => (content ? `<meta ${attribute}="${name}" content="${escapeText(content)}">` : '')
  return [
    `<link rel="canonical" href="${escapeText(meta.url)}">`,
    tag('name', 'description', meta.description),
    tag('property', 'og:type', 'article'),
    tag('property', 'og:site_name', siteName),
    tag('property', 'og:title', meta.heading),
    tag('property', 'og:description', meta.description),
    tag('property', 'og:url', meta.url),
    tag('property', 'og:image', meta.image),
    tag('property', 'article:published_time', meta.publishedAt),
    tag('name', 'author', meta.author),
    tag('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'),
    tag('name', 'twitter:title', meta.heading),
    tag('name', 'twitter:description', meta.description),
    tag('name', 'twitter:image', meta.image),
  ].filter(Boolean).join('')
}

const published = (posts) => posts.filter((post) => post && typeof post.slug === 'string' && SLUG.test(post.slug))

const isoDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function buildSitemap(posts, siteOrigin) {
  const entry = (loc, lastmod) => `<url><loc>${escapeText(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  const urls = [
    entry(`${siteOrigin}/`),
    ...published(posts).map((post) => entry(`${siteOrigin}/read/${post.slug}`, isoDate(post.publishedAt))),
    entry(`${siteOrigin}/privacy`),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`
}

export function buildRss(posts, { siteName, siteOrigin, description }) {
  const items = published(posts).map((post) => {
    const link = `${siteOrigin}/read/${post.slug}`
    const date = new Date(post.publishedAt)
    return [
      '<item>',
      `<title>${escapeText(post.title)}</title>`,
      `<link>${escapeText(link)}</link>`,
      `<guid isPermaLink="true">${escapeText(link)}</guid>`,
      Number.isNaN(date.getTime()) ? '' : `<pubDate>${date.toUTCString()}</pubDate>`,
      `<description>${escapeText(summarise(post.subtitle || post.excerpt || ''))}</description>`,
      ...(Array.isArray(post.tags) ? post.tags.map((tag) => `<category>${escapeText(tag.name)}</category>`) : []),
      '</item>',
    ].join('')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${escapeText(siteName)}</title>`,
    `<link>${escapeText(`${siteOrigin}/`)}</link>`,
    `<description>${escapeText(description)}</description>`,
    '<language>en</language>',
    `<atom:link href="${escapeText(`${siteOrigin}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '</channel></rss>\n',
  ].join('')
}
