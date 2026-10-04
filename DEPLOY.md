# Deploying Inkwell to inkwell.ahmadnadeem.dev

```
Browser ──> inkwell.ahmadnadeem.dev      Cloudflare Workers (static React app)
               │
               └──> inkwell-api.onrender.com   Render free web service (.NET API, Docker)
                         │
                         └──> Neon free Postgres
```

Every service below is on a free plan that needs **no credit card**. If any signup page asks for
one, stop and check you picked the free option.

| Service | Free allowance | What to expect |
|---|---|---|
| Cloudflare Workers (static assets) | Unlimited static requests | Nothing to watch |
| Render web service (Free) | 750 instance-hours/month (one service running 24/7 uses ~744) | Sleeps after 15 min idle; the first request after a nap takes ~30-50 s |
| Neon Postgres (Free) | 0.5 GB storage, compute scales to zero | First query after idle adds ~1 s. Text posts use very little space |

## 0. Put the code on GitHub (separate repo)

Render deploys from GitHub. Use a **new private repo containing only `inkwell/`**, not the whole
`Claude` folder, which holds unrelated projects.

```bash
cd inkwell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/inkwell.git
git push -u origin main
```

Check `git status` before pushing: `*.db` files and `node_modules/` should not be listed.

## 1. Database: Neon

1. Sign up at neon.tech (GitHub login works) and create a project named `inkwell`.
2. Open **Connect**. **Turn Connection pooling OFF** and copy the connection string
   (`postgresql://...`). The direct connection is the right one: migrations run on startup and
   use session-level locks, which pooled connections can break.

## 2. API: Render

1. Sign up at render.com with GitHub. **New + > Web Service**, pick the `inkwell` repo.
2. Settings:
   - **Name:** `inkwell-api` (this fixes the URL as `https://inkwell-api.onrender.com`)
   - **Language:** Docker (it finds `Dockerfile` at the repo root)
   - **Instance Type:** **Free**
   - **Health Check Path** (under Advanced): `/health`
3. Environment variables:

   | Key | Value |
   |---|---|
   | `Database__Provider` | `Postgres` |
   | `ConnectionStrings__Default` | the Neon string from step 1 |
   | `Jwt__Key` | a long random secret (generate below) |
   | `Cors__AllowedOrigins__0` | `https://inkwell.ahmadnadeem.dev` |

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Do **not** set `Seed__Enabled`. Seeding creates demo accounts with a published password, which
   must never exist on a public site.
4. **Create Web Service.** The first build takes several minutes. When the log shows
   `Now listening on`, open `https://inkwell-api.onrender.com/health`. It should say `Healthy`.
   The database tables are created automatically on first start.

If Render gave the service a different URL (the name was taken), put that URL in
`web/.env.production` as `VITE_API_BASE`.

## 3. Frontend: Cloudflare

From the `inkwell` folder:

```bash
cd web
npm install
npm run build
npx wrangler login
npx wrangler deploy
```

`wrangler login` opens a browser so you can approve access to your Cloudflare account.
`wrangler deploy` uploads the build and, because `wrangler.jsonc` declares the custom domain, also
creates `inkwell.ahmadnadeem.dev` and its DNS record (your domain is already on that account).

## 4. Check it

Open https://inkwell.ahmadnadeem.dev (the first load may be slow while Render wakes up), register,
write a post, publish it, then open the post link in a private window.

## Updating later

- **API:** `git push`. Render rebuilds automatically.
- **Frontend:** `cd web && npm run build && npx wrangler deploy`.

## Good to know

- Rotating `Jwt__Key` signs everyone out.
- Keeping the API awake with a pinger would use roughly the whole 750-hour allowance, so it is
  better to accept the cold start.
- When you outgrow free tiers, the app needs no changes: only the Render plan and Neon plan move.
