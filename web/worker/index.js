// A small Cloudflare Worker in front of the public site. The site itself is a single page that
// builds each post in the browser, which is invisible to anything that does not run scripts:
// link previews (LinkedIn, WhatsApp, Slack), feed readers and some search crawlers. This fills
// that gap, and nothing else:
//
//   /p/<post>      the normal page, with the post's title, description and picture added to its head
//   /sitemap.xml   every published post, for search engines
//   /rss.xml       the newest posts, for feed readers
//
// It runs only for those addresses (see run_worker_first in wrangler.jsonc); every other request is
// served straight from the static files and never reaches this code. If the API is slow or down,
// a post page is served unchanged, so the worst case is a missing preview, never a broken page.
//
// Free plan allowance: 100,000 runs a day. One run per post page opened, plus feed and sitemap fetches.

import { buildRss, buildSitemap, describePost, headTags, slugFromPath } from './meta.js'

/** The API sleeps when idle and can take a long time to wake. A preview is not worth holding a reader up for. */
const POST_TIMEOUT_MS = 2500
const LIST_TIMEOUT_MS = 20000

const POST_CACHE_SECONDS = 300
const LIST_CACHE_SECONDS = 600
const MAX_LISTED_POSTS = 500
const RSS_ITEMS = 30

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const site = {
      siteName: env.SITE_NAME || 'Inkwell',
      siteOrigin: url.origin,
      apiBase: String(env.API_BASE || '').replace(/\/+$/, ''),
      description: env.SITE_DESCRIPTION || 'Articles on Inkwell.',
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      try {
        if (url.pathname === '/sitemap.xml') {
          return await cachedDocument(request, ctx, 'application/xml; charset=utf-8', async () => buildSitemap(await listPosts(site, MAX_LISTED_POSTS), site.siteOrigin))
        }
        if (url.pathname === '/rss.xml') {
          return await cachedDocument(request, ctx, 'application/rss+xml; charset=utf-8', async () => buildRss(await listPosts(site, RSS_ITEMS), site))
        }

        const slug = slugFromPath(url.pathname)
        if (slug) return await postPage(request, env, ctx, site, slug)
      } catch (error) {
        if (url.pathname.endsWith('.xml')) {
          // An empty feed or sitemap would tell readers and search engines that every post is gone.
          return new Response('Temporarily unavailable. Please try again shortly.\n', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '120', 'Cache-Control': 'no-store' },
          })
        }
        console.log('preview unavailable', url.pathname, String(error))
      }
    }

    return env.ASSETS.fetch(request)
  },
}

async function getJson(url, timeoutMs) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`API answered ${response.status}`)
  return response.json()
}

async function listPosts(site, limit) {
  const posts = []
  for (let page = 1; posts.length < limit; page++) {
    const pageSize = Math.min(50, limit - posts.length)
    const data = await getJson(`${site.apiBase}/api/v1/posts?sort=Latest&pageSize=${pageSize}&pageNumber=${page}`, LIST_TIMEOUT_MS)
    if (!data || !Array.isArray(data.items)) throw new Error('unexpected list response')
    posts.push(...data.items)
    if (!data.hasNextPage || data.items.length === 0) break
  }
  return posts
}

/** Builds an XML document at most once every few minutes; in between, Cloudflare serves the stored copy. */
async function cachedDocument(request, ctx, contentType, build) {
  const cache = caches.default
  const key = new Request(new URL(request.url).toString(), { method: 'GET' })

  const hit = await cache.match(key)
  if (hit) return hit

  const response = new Response(await build(), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${LIST_CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
  ctx.waitUntil(cache.put(key, response.clone()))
  return response
}

/** The post as the API returns it, remembered briefly so a burst of previews is one API call, not many. */
async function cachedPost(ctx, site, slug) {
  const cache = caches.default
  const key = new Request(`https://post-meta.internal/${encodeURIComponent(slug)}`)

  const hit = await cache.match(key)
  if (hit) return hit.json()

  const post = await getJson(`${site.apiBase}/api/v1/posts/${encodeURIComponent(slug)}`, POST_TIMEOUT_MS)
  if (post) {
    // Only what the preview needs is kept; the body is reduced to its description first.
    const meta = describePost(post, site)
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(meta), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${POST_CACHE_SECONDS}` },
    })))
    return meta
  }
  return null
}

async function postPage(request, env, ctx, site, slug) {
  // Started together: the page is needed either way, and the preview must not delay it.
  const pagePromise = env.ASSETS.fetch(request)
  const meta = await cachedPost(ctx, site, slug).catch((error) => {
    console.log('post lookup failed', slug, String(error))
    return null
  })
  const page = await pagePromise

  const isHtml = (page.headers.get('Content-Type') || '').includes('text/html')
  if (!meta || !isHtml || !page.ok) return page

  const tags = headTags(meta, site.siteName)
  return new HTMLRewriter()
    .on('title', { element(element) { element.setInnerContent(meta.title) } })
    // The page's general description and address are replaced by the post's own.
    .on('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]', { element(element) { element.remove() } })
    .on('head', { element(element) { element.append(tags, { html: true }) } })
    .transform(page)
}
