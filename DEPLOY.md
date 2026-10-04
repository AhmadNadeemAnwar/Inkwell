# Deploying Inkwell to inkwell.ahmadnadeem.dev

```
Browser ──> inkwell.ahmadnadeem.dev      Cloudflare Workers (static React app)
               │
               └──> <name>.onrender.com        Render free web service (.NET API, Docker)
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
   - **Name:** `inkwell-api` (Render may append a suffix, e.g. `inkwell-zpbc`; use whatever URL it shows you)
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
   `Now listening on`, open `https://<your-service>.onrender.com/health`. It should say `Healthy`.
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

## Security configuration

### One-time Cloudflare settings (dashboard, free)

1. **SSL/TLS > Edge Certificates > Always Use HTTPS: On.** Without it,
   `http://inkwell.ahmadnadeem.dev` answers in plain text instead of redirecting.
2. The site also sends an HSTS header, so browsers stick to HTTPS after the first visit.

### Optional: Turnstile bot check on sign-up (free)

Off until you configure it, and everything works without it.

1. Cloudflare dashboard > **Turnstile > Add widget**. Hostname: `inkwell.ahmadnadeem.dev`.
2. Put the **site key** in `web/.env.production` as `VITE_TURNSTILE_SITE_KEY`, then rebuild and
   `npx.cmd wrangler deploy`.
3. Put the **secret key** in Render as `Turnstile__SecretKey`.

### How the protections work

| Control | Where | Notes |
|---|---|---|
| Rate limits | API | Sign-in 10/min, sign-up 5/hour, search 30/min, other reads 300/min, writes 30/min, each per client |
| Real client address | API | Read from `CF-Connecting-IP` (set in `appsettings.Production.json`). Render sits behind Cloudflare, which always overwrites that header |
| Account lockout | API | 10 wrong passwords on one account in 15 minutes locks it for the rest of the window, whichever addresses the attempts came from |
| Password rules | API | 10+ characters, not a common password, not built from your name/handle/email, not in a known breach (checked via haveibeenpwned's k-anonymity API, so only 5 characters of a hash leave the server) |
| URL allow-list | API + web | Profile websites must be http(s); avatars and cover images must be https |
| Security headers | Cloudflare (`web/public/_headers`) and API middleware | CSP, nosniff, frame denial, HSTS, referrer policy |
| Session tokens | API | Valid for 24 hours (`Jwt__ExpiryMinutes` to change) |

### Verify the rate limiter after deploying

The limiter only works if the API can see each visitor's real address. Confirm it on the live
API (a clean run shows ten `400`s, then `429`s):

```bash
for i in $(seq 1 14); do curl -s -o /dev/null -w "%{http_code} " -X POST https://<your-service>.onrender.com/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"user$i@example.com\",\"password\":\"x\"}"; done
```

If you never see a `429`, Render is not forwarding `CF-Connecting-IP`; the limiter then falls back to
the proxy's address. Account lockout still protects every account in that case.

### Known limits

- Session tokens live in the browser's local storage. Moving them to HttpOnly cookies needs the API
  on a same-site domain (for example `api.ahmadnadeem.dev`); on a separate `onrender.com` domain
  browsers block those cookies. The strict CSP and 24-hour expiry limit the exposure meanwhile.
- Tokens cannot be revoked before they expire.
- Sign-up does not verify email ownership; that needs an email provider.
- Registering reveals whether an email is already taken. The 5-per-hour sign-up limit makes
  harvesting slow; email verification is the real fix.
