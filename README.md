# Inkwell

A content publishing platform in the shape of Medium: anyone can write and publish posts on any
topic, and anyone can search, browse and discuss them.

ASP.NET Core 10 Web API (layered / "Clean Architecture") + React 19 SPA with a TipTap editor.

## Running it

Two processes. Both need to be running.

**API** — http://localhost:5231, Swagger at `/swagger`:

```bash
dotnet run --project inkwell/src/Inkwell.Api
```

**Web** — http://localhost:5173:

```bash
npm install --prefix inkwell/web
```

```bash
npm run dev --prefix inkwell/web
```

The Vite dev server proxies `/api` to the API, so the browser stays on one origin and there is no
CORS preflight in development.

On first run the API applies migrations and seeds three writers and six posts into
`inkwell/src/Inkwell.Api/inkwell.db`. Every seeded account uses the password `Password123!` —
sign in as `maya@example.com` to look around, or register a new account.

**Tests** — 63 tests over the domain, application services and repositories:

```bash
dotnet test inkwell/tests/Inkwell.Tests
```

## Architecture

```
inkwell/
  src/
    Inkwell.Domain          Entities, invariants, repository interfaces. No framework dependencies.
    Inkwell.Application     DTOs, services, validators, editor-document handling. Depends on Domain.
    Inkwell.Infrastructure  EF Core, repositories, migrations, BCrypt, JWT. Depends on Domain + Application.
    Inkwell.Api             Controllers, middleware, auth, rate limiting, DI. Depends on Application + Infrastructure.
  tests/
    Inkwell.Tests           xUnit + FluentAssertions, over a real in-memory SQLite database.
  web/                      Vite + React 19 + TypeScript client.
```

Dependencies point inward: `Api -> Application/Infrastructure -> Domain`.

### Data model

| Entity | Purpose |
|---|---|
| `User` | Account and public profile. `Handle` is the public identity and is immutable. |
| `Post` | Title, subtitle, slug, editor document, status, denormalised engagement counters. |
| `Tag` / `PostTag` | Topic taxonomy. `Tag.PostCount` is maintained on publish/unpublish. |
| `Comment` | Threaded one level deep; soft-deleted so replies keep their place. |
| `Clap` | One row per reader per post; repeat claps accumulate up to a per-user cap. |
| `Bookmark` | Reading list. |
| `UserFollow` / `TagFollow` | Follow a writer or a topic — both feed the personal feed. |
| `PostRevision` | Snapshot written before every edit, so a draft is always recoverable. |

### Decisions worth knowing

**Post bodies are stored as ProseMirror/TipTap JSON, not HTML.** The reading view walks that JSON
and renders React elements for a fixed set of node and mark types — there is no
`dangerouslySetInnerHTML` anywhere in the client, so a crafted document cannot inject markup into a
reader's page. `javascript:` and `data:` URLs are dropped from links and images. Storing structured
JSON also means old posts can be re-themed later, which raw HTML would prevent.

**Plain text is derived on the server, never accepted from the client.** `ProseMirrorText.Extract`
flattens the document into `Post.PlainText`, which backs search, excerpts and reading time. Trusting
the browser for it would let a caller poison search results.

**Slugs are assigned once, at first publish, and never recomputed.** Retitling a published post keeps
its URL. Collisions get a short random discriminator rather than a count-and-retry loop.

**Search lives behind a single repository method.** `PostRepository.SearchAsync` is the only place
that knows how matching works. It currently uses SQL `LIKE` with user wildcards stripped, which is
portable and fine at this scale; moving to Postgres `tsvector` + a GIN index changes that one method
and nothing else.

**SQLite stores timestamps as UTC ticks.** SQLite has no native `DateTimeOffset` and refuses to
`ORDER BY` one, which would break every "newest first" query. A value converter applied in
`AppDbContext` maps them to integers; on Postgres the conversion is skipped and `timestamptz` is used.

**Writes are rate limited, reads are not.** A fixed window of 30 writes per minute is partitioned by
user (falling back to IP), so browsing never hits a limit but comment and publish spam does.

**Passwords are BCrypt with work factor 12**, and login returns the same message for a wrong password
and an unknown email so the endpoint cannot be used to enumerate registered accounts.

## API

All routes are under `/api/v1`. Anonymous readers can browse, search and read; everything else needs
a bearer token from `/auth/login`.

| Method | Route | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Returns a JWT and the current user |
| GET | `/auth/me` | Restores a session on page load |
| GET | `/posts` | Browse + search: `q`, `tag`, `author`, `sort`, `pageNumber`, `pageSize` |
| GET | `/posts/feed` | Posts from followed writers and topics |
| GET | `/posts/drafts`, `/posts/bookmarks` | The caller's own drafts and reading list |
| GET | `/posts/{slug}` | Read by canonical slug; counts a view |
| GET | `/posts/{id}/edit` | Load for editing, including drafts |
| GET | `/posts/{id}/related` | Ranked by shared tags |
| GET | `/posts/{id}/revisions` | Autosave history |
| POST | `/posts` | Create a draft |
| PUT | `/posts/{id}` | Save an edit (also writes a revision) |
| POST | `/posts/{id}/publish`, `/posts/{id}/unpublish` | |
| DELETE | `/posts/{id}` | |
| POST | `/posts/{id}/claps`, `/posts/{id}/bookmark` | |
| GET/POST | `/posts/{id}/comments` | Read/add; `parentId` for replies |
| PUT/DELETE | `/comments/{id}` | Author of the comment or of the post |
| GET | `/users/{handle}`, `/users/{handle}/posts` | Public profile |
| PUT | `/users/me` | Update your profile |
| POST | `/users/{handle}/follow`, `/tags/{slug}/follow` | Toggles |
| GET | `/tags`, `/tags/suggest`, `/tags/following` | Popular, type-ahead, followed |

Errors are RFC 7807 problem details: `NotFoundException` → 404, `ForbiddenException` → 403,
`ConflictException` → 409, `DomainException` → 400, anything else → 500 with the detail suppressed
outside development.

## Configuration

`Jwt:Key` must be at least 32 characters or the API refuses to start rather than issuing tokens
signed with a weak key. The development value is in `appsettings.Development.json`; in any deployed
environment set it via `JWT__KEY` and never commit it.

## What is deliberately not built yet

Ordered roughly by value per unit of effort:

1. **Image uploads.** Cover images and inline images take a URL today. Wire an object store
   (Cloudflare R2 or Supabase Storage, both with usable free tiers) and a presigned-upload endpoint.
2. **Email.** Password reset, and the per-author newsletter that actually retains readers.
3. **Server-side rendering.** A publishing platform that renders only on the client is invisible to
   search engines, which defeats the point. This is the single biggest gap for a real launch.
   Also needed: `sitemap.xml`, RSS per author and per tag, and OG images.
4. **Moderation tooling.** Report flow, an admin queue, and soft-delete/shadowban. Rate limiting is
   in place; the human process around it is not.
5. **Inline highlights and annotations.** Medium's signature feature and a genuine differentiator —
   select text, highlight it, optionally attach a public response.
6. **Writer analytics.** Views are counted but not surfaced. Read *ratio* (scroll-depth completion)
   matters more to writers than raw views.
7. **Publications.** Multi-author blogs with member roles.
8. **Semantic related-posts and search** via embeddings in `pgvector`, replacing tag-overlap ranking
   and enabling natural-language queries.
9. **Series/collections**, co-authoring, and Markdown import/export.
