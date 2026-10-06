// Pure helpers for the Cloudflare program in front of the public site (see index.js). Nothing here
// touches the network, so every rule can be unit tested.

const STORED_IMAGE = /^\/api\/v1\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/

export const DESCRIPTION_LENGTH = 200

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

/** The post address in a URL path, or null if it is not shaped like one (so it is never sent to the API). */
export function slugFromPath(pathname) {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname)
  if (!match) return null
  let slug
  try {
    slug = decodeURIComponent(match[1])
  } catch {
    return null
  }
  return SLUG.test(slug) ? slug : null
}

/** The words of a stored post body, in order, with formatting dropped. */
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
    if (node.type === 'imageSection' && typeof node.attrs?.caption === 'string') parts.push(node.attrs.caption)
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

/** A picture address a preview may use: one uploaded to this site, or an https link. Anything else is dropped. */
export function absoluteImage(value, apiBase) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const trimmed = value.trim()
  if (STORED_IMAGE.test(trimmed)) return `${apiBase}${trimmed}`
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/** What a shared link to a post should show. */
export function describePost(post, { siteName, siteOrigin, apiBase }) {
  const description = summarise(post.subtitle || plainText(post.contentJson) || `An article on ${siteName}.`)
  return {
    title: `${post.title} · ${siteName}`,
    heading: post.title,
    description,
    url: `${siteOrigin}/p/${post.slug}`,
    image: absoluteImage(post.coverImageUrl, apiBase),
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
    ...published(posts).map((post) => entry(`${siteOrigin}/p/${post.slug}`, isoDate(post.publishedAt))),
    entry(`${siteOrigin}/privacy`),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`
}

export function buildRss(posts, { siteName, siteOrigin, description }) {
  const items = published(posts).map((post) => {
    const link = `${siteOrigin}/p/${post.slug}`
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
