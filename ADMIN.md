# The admin portal

A private site at **https://admin.ahmadnadeem.dev** for running Inkwell and editing your portfolio.

| Section | What you can do |
|---|---|
| Dashboard | Totals, a 30-day publishing chart, most viewed and most clapped posts |
| Posts | **Write, edit and publish** your own posts. Every post including drafts: search, filter, **take down**, **delete** |
| Comments | Every comment across the site: **remove** |
| Topics | **Rename**, **merge** and **delete** tags |
| Portfolio | Create, edit and delete your site's **blog**, **projects** and **updates** (Markdown, with a live preview) |

Sign-up stays closed. Only your own account can sign in, with your email and a code from an
authenticator app. There is no password on this site: your phone is the key, so keep it locked.

```
 admin.ahmadnadeem.dev  ──>  Render API (Inkwell)  ──>  GitHub (private portfolio repo)
 Cloudflare Workers          /api/v1/admin/*            every save is a commit
                                                              │
                                                  Cloudflare rebuilds ahmadnadeem.dev
```

Portfolio edits are **commits to a private GitHub repository**. That keeps the portfolio a fast static
site, gives you full history and undo, and costs nothing. Cloudflare rebuilds the site by itself about
a minute after each save.

Everything here is on free plans and none of it needs a card.

---

## Setup

Four steps, in this order. Steps 1 and 4 are required; 2 and 3 are only for portfolio editing, and
the rest of the portal works without them.

### 1. Create your authenticator secret (2 minutes)

You need an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy,
1Password, any of them). From the `inkwell` folder, using your **Inkwell login email**:

```powershell
dotnet run --project tools/Inkwell.AdminSetup -- you@example.com
```

It shows a QR code, you scan it, type the code your app displays to prove it works, and it prints two
lines. Add them as environment variables on your Render service (Environment tab), then save so it
redeploys:

| Key | Value |
|---|---|
| `Admin__Emails__0` | the email address you gave the tool |
| `Admin__TotpSecret` | the secret it printed |

The secret is as sensitive as a password. Don't paste it into chat, email or the repository. The QR
image is deleted when the tool finishes.

> If you ever lose your phone, run the tool again and replace `Admin__TotpSecret` on Render. The old
> secret stops working immediately.

### 2. Put your portfolio in its own private GitHub repo (5 minutes)

Today `portfolio-site` lives inside your larger `Claude` folder. The portal needs it as its own repo.

1. On GitHub, create a **private** repository, for example `portfolio`. Leave it empty.
2. Then:

   ```powershell
   cd portfolio-site
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/portfolio.git
   git push -u origin main
   ```

   The existing `.gitignore` keeps `node_modules`, `dist` and `.astro` out. Check `git status` before
   pushing if you want to be sure nothing private is included.
3. Make Cloudflare build it from that repo, so a push (including one from the portal) redeploys the site.
   In the Cloudflare dashboard open **Workers & Pages**, then your portfolio Worker
   (`ahmadnadeemanwar`), then **Settings → Builds → Connect**, and choose the repository. Use
   `npm run build` as the build command and `npx wrangler deploy` as the deploy command. A
   `wrangler.jsonc` is already in `portfolio-site` for this.

   Free plans include [3,000 build minutes a month](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/),
   far more than editing needs.

### 3. Give the API permission to edit that repo (3 minutes)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**.
2. **Repository access: Only select repositories**, and pick the portfolio repo (nothing else).
3. **Permissions → Repository permissions → Contents: Read and write.** Leave everything else off.
4. Set an expiry (GitHub allows up to a year) and put a reminder in your calendar to renew it.
5. On Render, add these environment variables:

   | Key | Value |
   |---|---|
   | `Portfolio__Repo` | `your-username/portfolio` |
   | `Portfolio__Token` | the token GitHub just showed you (shown once) |
   | `Portfolio__Branch` | optional, defaults to `main` |

Never paste the token anywhere except Render. Because it is limited to one repository and one
permission, the worst a leaked token could do is change your portfolio's files, and every change is in
git history.

### 4. Deploy the admin site (5 minutes)

First push the API so it has the admin routes (Render redeploys by itself):

```powershell
git push
```

Then the admin app:

```powershell
cd admin
npm install
npm run build
npx.cmd wrangler deploy
```

`wrangler deploy` creates `admin.ahmadnadeem.dev` and its DNS record. Open it and sign in with your
email and the current 6-digit code.

> If your API URL isn't `https://inkwell-zpbc.onrender.com`, change it in **both**
> `admin/.env.production` and `admin/public/_headers` before building.

---

## Using it

**Writing:** *New post* (on the Dashboard and the Posts page) opens the editor; *Edit* appears beside
every post that is yours.
- A post is a list of **sections**. *Add a section* offers **Text**, **Image** and **References**.
  Each section has arrows to move it up or down, and a cross to delete it.
- **Image:** choose a picture from your device. It is shrunk in the browser (1600 pixels on its
  longer side at most) and stored in the site's own database, so no other service is involved.
  JPEG, PNG and WebP only. *Describe the picture* is read aloud to people who cannot see it.
- **References:** a numbered list of sources. Each needs a title; the link is optional.
- A post that readers cannot see saves itself a few seconds after you stop typing. A published post
  is live, so changes to it wait until you press *Save changes*.

**Post status:** a post is in exactly one of three states, changed from the *Status* menu in the
editor or in the Posts list.

| Status | Who can see it |
|---|---|
| Draft | Only you. Not finished yet. |
| Published | Everyone. The first publish fixes its address for good. |
| Not active | Only you. Switched off; it keeps its address, so publishing again restores the same link. |

**Reader numbers:** readers have no accounts, so the site tells them apart by a random id each
browser makes up for itself. Only a scrambled form of it is stored, and it is not tied to a person.
- **Claps** and **Insightful** count readers, not clicks: one of each per reader per post, and a
  second click takes it back.
- **Views** count one per reader per post per day. They are reported by the reader's browser once
  the post is on screen, so refreshes, search-engine crawlers and link previews are left out.
- These are honest but not tamper-proof: someone who clears their browser's site data counts as a
  new reader. Each address is limited to 30 reactions a minute.
- Comments are no longer shown on the public site. Existing ones remain in the Comments section.

**Image storage allowance:** the free database holds 0.5 GB in total. Images are capped at 300 MB
together, about 1,500 pictures at a typical 200 KB each. When the cap is reached, uploads are
refused with a clear message; nothing is charged and nothing already stored is affected.
- Unsaved writing is also kept in your browser. If the 2-hour session ends or the tab closes
  mid-sentence, reopen the post and choose *Restore it*.

**Posts** and **Comments** act immediately and always ask first. *Take down* returns a post to draft
(its author can republish it); *Delete* is permanent.

**Topics:** renaming changes the display name only; the address (`/tag/<slug>`) never changes, so
existing links keep working. *Merge* moves every post and follower onto the other topic, then removes
the first. *Delete* removes the topic from its posts but keeps the posts.

**Portfolio:** pick Blog, Projects or Updates.
- **New entry** creates a Markdown file. The file name is chosen once, from the title by default, and
  can't be changed afterwards because it is the entry's address.
- Fields follow your site's schema, and the API checks everything again before committing, so a
  mistake can't break the site's build. It tells you exactly what to fix.
- Saved files use the same formatting as your existing ones, so editing one field changes one line.
- If you or anything else changed the same file on GitHub while you had it open, the save is refused
  and your edit stays on screen. Nothing is overwritten.
- Deleting removes the file, but it stays in git history on GitHub.

Admin actions are recorded in the API's logs (Render → Logs) with your email and what was changed.

## How it is protected

- **One factor: the authenticator code.** The admin token comes only from
  `/api/v1/admin/auth/login`, which needs an email on the admin list and a current code. Ordinary
  sign-in tokens never work on admin routes, even with the right password. A code works once.
  This is a deliberate trade of some safety for convenience: whoever holds your unlocked phone can
  get in, and a code is only 6 digits, which is why wrong guesses are limited so tightly (below).
- **Revocable instantly.** The admin list is checked on every request, so removing your email from
  `Admin__Emails__0` locks that account out at once.
- **Short sessions.** An admin session lasts 2 hours and lives in the browser tab only; closing the
  tab signs you out.
- **Throttled.** 5 sign-in attempts per minute per visitor, and the account locks for an hour after
  5 wrong codes, wherever they came from. That holds a determined guesser to about 120 tries a day
  out of a million possible codes. Every failure gets the same message, so it never reveals which
  part was wrong. The cost: someone who knows your email can keep you locked out by guessing.
- **Locked-down site.** The admin site sends a strict content policy, can't be framed, and is hidden
  from search engines.
- **Narrow GitHub access.** The token reaches one repository with one permission, only
  `blog`, `projects` and `updates` can be edited, and file paths are restricted so nothing outside the
  content folder can be touched.

## Troubleshooting

| You see | Likely cause |
|---|---|
| "Invalid email or code" | One of the two is wrong. Check the email is on `Admin__Emails__0`, wait for a *new* code (each works once), and check your phone's clock is set automatically. |
| "Too many failed attempts" | Wait an hour, or fix `Admin__TotpSecret` if the app and server disagree. |
| Sign-in works but pages say you're signed out | The email isn't on the admin list any more, or the session ended (2 hours). Sign in again. |
| Portfolio shows setup instructions | `Portfolio__Repo` or `Portfolio__Token` is missing on Render. |
| "GitHub rejected the token" | It expired or was revoked. Create a new one and update Render. |
| "GitHub refused the request" | The token lacks **Contents: Read and write** on that repository. |
| Saved, but the site didn't change | Cloudflare's build may have failed. Check **Workers & Pages → your Worker → Deployments**. |

## Limits worth knowing

- The code-replay memory and the lockout counters live in the API's memory, which is right for one
  server. They reset when Render restarts the service, which only gives an attacker a fresh window,
  not access.
- The portfolio editor handles Markdown and the fields in your schema. It doesn't upload images; link to
  images by URL for now. (Inkwell posts do upload images.)
- A picture removed from a post stays in the database; there is no screen yet to delete unused ones.
- Pictures are served by the API on Render, so the first one after the server has been idle is slow.
- To try the portal on your own machine, the API's development settings include a throwaway admin
  (`maya@example.com`) and authenticator secret. They exist only in `appsettings.Development.json` and
  are never used by the deployed site.
- If you change `src/content.config.ts` in the portfolio, update the matching rules in
  `src/Inkwell.Application/Portfolio/PortfolioContent.cs` and `admin/src/portfolio/schema.ts`.
