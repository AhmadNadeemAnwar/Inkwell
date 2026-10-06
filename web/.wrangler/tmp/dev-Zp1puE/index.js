var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/meta.js
var STORED_IMAGE = /^\/api\/v1\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
var DESCRIPTION_LENGTH = 200;
function escapeText(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
__name(escapeText, "escapeText");
function slugFromPath(pathname) {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  let slug;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return SLUG.test(slug) ? slug : null;
}
__name(slugFromPath, "slugFromPath");
function plainText(contentJson) {
  let root;
  try {
    root = JSON.parse(contentJson);
  } catch {
    return "";
  }
  const parts = [];
  const walk = /* @__PURE__ */ __name((node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.text === "string") parts.push(node.text);
    if (node.type === "imageSection" && typeof node.attrs?.caption === "string") parts.push(node.attrs.caption);
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
      parts.push(" ");
    }
  }, "walk");
  walk(root);
  return parts.join("").replace(/\s+/g, " ").trim();
}
__name(plainText, "plainText");
function summarise(text, max = DESCRIPTION_LENGTH) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, "")}\u2026`;
}
__name(summarise, "summarise");
function absoluteImage(value, apiBase) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  if (STORED_IMAGE.test(trimmed)) return `${apiBase}${trimmed}`;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
__name(absoluteImage, "absoluteImage");
function describePost(post, { siteName, siteOrigin, apiBase }) {
  const description = summarise(post.subtitle || plainText(post.contentJson) || `An article on ${siteName}.`);
  return {
    title: `${post.title} \xB7 ${siteName}`,
    heading: post.title,
    description,
    url: `${siteOrigin}/p/${post.slug}`,
    image: absoluteImage(post.coverImageUrl, apiBase),
    author: post.author?.displayName ?? null,
    publishedAt: post.publishedAt ?? null
  };
}
__name(describePost, "describePost");
function headTags(meta, siteName) {
  const tag = /* @__PURE__ */ __name((attribute, name, content) => content ? `<meta ${attribute}="${name}" content="${escapeText(content)}">` : "", "tag");
  return [
    `<link rel="canonical" href="${escapeText(meta.url)}">`,
    tag("name", "description", meta.description),
    tag("property", "og:type", "article"),
    tag("property", "og:site_name", siteName),
    tag("property", "og:title", meta.heading),
    tag("property", "og:description", meta.description),
    tag("property", "og:url", meta.url),
    tag("property", "og:image", meta.image),
    tag("property", "article:published_time", meta.publishedAt),
    tag("name", "author", meta.author),
    tag("name", "twitter:card", meta.image ? "summary_large_image" : "summary"),
    tag("name", "twitter:title", meta.heading),
    tag("name", "twitter:description", meta.description),
    tag("name", "twitter:image", meta.image)
  ].filter(Boolean).join("");
}
__name(headTags, "headTags");
var published = /* @__PURE__ */ __name((posts) => posts.filter((post) => post && typeof post.slug === "string" && SLUG.test(post.slug)), "published");
var isoDate = /* @__PURE__ */ __name((value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}, "isoDate");
function buildSitemap(posts, siteOrigin) {
  const entry = /* @__PURE__ */ __name((loc, lastmod) => `<url><loc>${escapeText(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`, "entry");
  const urls = [
    entry(`${siteOrigin}/`),
    ...published(posts).map((post) => entry(`${siteOrigin}/p/${post.slug}`, isoDate(post.publishedAt))),
    entry(`${siteOrigin}/privacy`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>
`;
}
__name(buildSitemap, "buildSitemap");
function buildRss(posts, { siteName, siteOrigin, description }) {
  const items = published(posts).map((post) => {
    const link = `${siteOrigin}/p/${post.slug}`;
    const date = new Date(post.publishedAt);
    return [
      "<item>",
      `<title>${escapeText(post.title)}</title>`,
      `<link>${escapeText(link)}</link>`,
      `<guid isPermaLink="true">${escapeText(link)}</guid>`,
      Number.isNaN(date.getTime()) ? "" : `<pubDate>${date.toUTCString()}</pubDate>`,
      `<description>${escapeText(summarise(post.subtitle || post.excerpt || ""))}</description>`,
      ...Array.isArray(post.tags) ? post.tags.map((tag) => `<category>${escapeText(tag.name)}</category>`) : [],
      "</item>"
    ].join("");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${escapeText(siteName)}</title>`,
    `<link>${escapeText(`${siteOrigin}/`)}</link>`,
    `<description>${escapeText(description)}</description>`,
    "<language>en</language>",
    `<atom:link href="${escapeText(`${siteOrigin}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "</channel></rss>\n"
  ].join("");
}
__name(buildRss, "buildRss");

// worker/index.js
var POST_TIMEOUT_MS = 2500;
var LIST_TIMEOUT_MS = 2e4;
var POST_CACHE_SECONDS = 300;
var LIST_CACHE_SECONDS = 600;
var MAX_LISTED_POSTS = 500;
var RSS_ITEMS = 30;
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const site = {
      siteName: env.SITE_NAME || "Inkwell",
      siteOrigin: url.origin,
      apiBase: String(env.API_BASE || "").replace(/\/+$/, ""),
      description: env.SITE_DESCRIPTION || "Articles on Inkwell."
    };
    if (request.method === "GET" || request.method === "HEAD") {
      try {
        if (url.pathname === "/sitemap.xml") {
          return await cachedDocument(request, ctx, "application/xml; charset=utf-8", async () => buildSitemap(await listPosts(site, MAX_LISTED_POSTS), site.siteOrigin));
        }
        if (url.pathname === "/rss.xml") {
          return await cachedDocument(request, ctx, "application/rss+xml; charset=utf-8", async () => buildRss(await listPosts(site, RSS_ITEMS), site));
        }
        const slug = slugFromPath(url.pathname);
        if (slug) return await postPage(request, env, ctx, site, slug);
      } catch (error) {
        if (url.pathname.endsWith(".xml")) {
          return new Response("Temporarily unavailable. Please try again shortly.\n", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "120", "Cache-Control": "no-store" }
          });
        }
        console.log("preview unavailable", url.pathname, String(error));
      }
    }
    return env.ASSETS.fetch(request);
  }
};
async function getJson(url, timeoutMs) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API answered ${response.status}`);
  return response.json();
}
__name(getJson, "getJson");
async function listPosts(site, limit) {
  const posts = [];
  for (let page = 1; posts.length < limit; page++) {
    const pageSize = Math.min(50, limit - posts.length);
    const data = await getJson(`${site.apiBase}/api/v1/posts?sort=Latest&pageSize=${pageSize}&pageNumber=${page}`, LIST_TIMEOUT_MS);
    if (!data || !Array.isArray(data.items)) throw new Error("unexpected list response");
    posts.push(...data.items);
    if (!data.hasNextPage || data.items.length === 0) break;
  }
  return posts;
}
__name(listPosts, "listPosts");
async function cachedDocument(request, ctx, contentType, build) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = new Response(await build(), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${LIST_CACHE_SECONDS}`,
      "X-Content-Type-Options": "nosniff"
    }
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}
__name(cachedDocument, "cachedDocument");
async function cachedPost(ctx, site, slug) {
  const cache = caches.default;
  const key = new Request(`https://post-meta.internal/${encodeURIComponent(slug)}`);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const post = await getJson(`${site.apiBase}/api/v1/posts/${encodeURIComponent(slug)}`, POST_TIMEOUT_MS);
  if (post) {
    const meta = describePost(post, site);
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(meta), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${POST_CACHE_SECONDS}` }
    })));
    return meta;
  }
  return null;
}
__name(cachedPost, "cachedPost");
async function postPage(request, env, ctx, site, slug) {
  const pagePromise = env.ASSETS.fetch(request);
  const meta = await cachedPost(ctx, site, slug).catch((error) => {
    console.log("post lookup failed", slug, String(error));
    return null;
  });
  const page = await pagePromise;
  const isHtml = (page.headers.get("Content-Type") || "").includes("text/html");
  if (!meta || !isHtml || !page.ok) return page;
  const tags = headTags(meta, site.siteName);
  return new HTMLRewriter().on("title", { element(element) {
    element.setInnerContent(meta.title);
  } }).on('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]', { element(element) {
    element.remove();
  } }).on("head", { element(element) {
    element.append(tags, { html: true });
  } }).transform(page);
}
__name(postPage, "postPage");

// ../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Batrjo/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Batrjo/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
