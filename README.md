# 💸 Notion Expense Tracker

A minimal, frictionless web app to log expenses directly into your Notion finance system. Built with Next.js, deployable to Vercel in minutes.

## Features
- 🔐 Sign in with Notion (OAuth)
- 🏷️ Pulls active categories dynamically (no snooze, no archived)
- 🕐 Remembers last used category
- ⚡ One-tap reuse of recent transactions
- 📱 PWA-ready — add to iPhone home screen

---

## Setup

### 1. Create a Notion OAuth App

The app uses two separate Notion integrations: an **Internal** one for
`NOTION_TOKEN` (all data access), and a **Public** one purely to gate sign-in
to the two authorized people.

1. Go to [notion.so/profile/integrations](https://notion.so/profile/integrations)
2. Click **"New integration"** → choose type **"Public"** (not Internal)
3. Fill in:
   - Name: `Expense Tracker`
   - Redirect URI: `https://YOUR-VERCEL-URL.vercel.app/api/auth/callback`
4. Under **Capabilities**, enable **"User information with email addresses"**
   (needed so the callback can check the signed-in email against
   `ALLOWED_NOTION_EMAILS`)
5. Copy **Client ID** and **Client Secret**

### 2. Share your databases with the integration

In Notion, open:
- Your **Transactions** database → `...` → Connections → add your integration
- Your **Categories** database → same
- Your **Accounts** database → same

### 3. Deploy to Vercel

```bash
# Clone or upload this folder to a GitHub repo, then:
# 1. Go to vercel.com → New Project → import your repo
# 2. Add environment variables (see below)
# 3. Deploy
```

### 4. Environment Variables (set in Vercel dashboard)

| Variable | Value |
|---|---|
| `NOTION_TOKEN` | Internal Notion integration secret with access to the three finance databases |
| `NOTION_OAUTH_CLIENT_ID` | From your Notion OAuth app |
| `NOTION_OAUTH_CLIENT_SECRET` | From your Notion OAuth app |
| `APP_URL` | Your Vercel URL e.g. `https://myapp.vercel.app` (no trailing slash) |
| `SESSION_SECRET` | Run: `openssl rand -base64 32` |
| `ALLOWED_NOTION_EMAILS` | Comma-separated list of the two allowed Notion account emails |
| `SHORTCUT_API_TOKEN` | Separate random bearer token for Apple Shortcuts, e.g. `openssl rand -hex 32` |
| `CRON_SECRET` | Separate random token used by the scheduled cache refresh, e.g. `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Recommended shared cache credentials from Upstash Redis or a Vercel KV integration. Vercel's prefixed `*_KV_REST_API_URL` / `*_KV_REST_API_TOKEN` names are also accepted. |
| `SHORTCUT_OPTIONS_CACHE_TTL_SECONDS` | Stale threshold for cached options; defaults to `3600` |

The Shortcut endpoints never expose or accept `NOTION_TOKEN`. Configure the
two Shortcut/cache secrets separately. A Redis REST cache is recommended for
Vercel because function instances do not share memory. If Redis credentials
are omitted or temporarily unavailable, the adapter falls back to process
memory and the options response remains usable but is not shared across
instances.

See [docs/apple-shortcut.md](docs/apple-shortcut.md) for the exact Shortcut
actions and endpoint payloads.

### 5. Add to iPhone Home Screen

1. Open your Vercel URL in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. Name it **💸 Expenses** → Add

---

## Local Development

### 1. Add localhost to your Notion OAuth app

Before running locally, open your Notion integration settings and add a **second** redirect URI:
```
http://localhost:3000/api/auth/callback
```
You need both — the `localhost` one for local dev and your Vercel URL for production.

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Then edit `.env.local` and fill in:

| Variable | How to get it |
|---|---|
| `NOTION_OAUTH_CLIENT_ID` | Notion integration settings |
| `NOTION_OAUTH_CLIENT_SECRET` | Notion integration settings |
| `APP_URL` | Leave as `http://localhost:3000` for local dev |
| `SESSION_SECRET` | Run: `openssl rand -base64 32` |
| `ALLOWED_NOTION_EMAILS` | Comma-separated list of the two allowed Notion account emails |

### 3. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`; the sign-in button redirects you through Notion OAuth and back to `localhost`.

> **Tip:** If you get a "redirect_uri mismatch" error from Notion, double-check that `http://localhost:3000/api/auth/callback` is saved in your Notion integration's redirect URIs list.

## Faster reads with a synchronized database

Use the **Neon Free** plan and copy its pooled Postgres connection string into
`DATABASE_URL` in `.env.local` and Vercel. Keep it server-only. The mirror tables
initialize automatically; [the SQL migration](db/migrations/001_finance_mirror.sql)
is also available for deployments that restrict DDL permissions. Configure a
separate `CRON_SECRET` and enable Vercel Fluid compute for the bounded background
sync lifetime. No paid scheduler is required: the configured cron runs daily,
and active reads refresh snapshots older than one minute in the background.

Seed the mirror using an authenticated `GET /api/sync/refresh` with
`Authorization: Bearer <CRON_SECRET>`. The app can seed it on demand too; until
the first successful import, it keeps using Notion. A normal app reload reads
from Postgres. **Sync now** explicitly imports direct Notion changes and then
reloads the displayed data. App saves continue to write to Notion and invalidate
the mirror before writing; refreshes use live Notion until a new import succeeds.

See [the sync architecture and public-app roadmap](docs/financial-sync.md) for
freshness, recovery, testing, and deployment limits.

## Optional Gemini assistance

Set server-only `GEMINI_API_KEY` in `.env.local` and Vercel, then restart or
redeploy. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; choose a supported
text model with structured output in your Google AI Studio project. Keep the
project on Google's free tier if you require $0 API usage. Quotas and model
access vary; the app makes one bounded request per explicit action with no
automatic retries, grounding tools, or paid fallback. A paid Google project
can still charge for that same request; the app cannot determine billing tier.

- **Type it:** write natural text, select **Parse with Gemini**, review the
  resulting lines and pick any missing categories/accounts, then save. Simple
  entries such as `pizza 19 yesterday` still work locally without Gemini.
  Ambiguous input returns questions while preserving the original text.
- **Rebalance:** describe what you need to cover and select **Suggest moves**.
  **Use suggestion** loads amounts into the existing review flow; **Apply**
  confirms changes. Suggestions only move money among active spending categories
  in the selected scope/current month. Savings, unassigned money and unpaid bill
  reservations are excluded. Live balances and bill reservations are rechecked
  before applying a suggestion. If bill data can't be read, suggestions fail
  rather than assuming there are no commitments. Budget changes require a sync
  and a fresh suggestion. Suggested moves use whole dirhams, matching Rebalance.

Parsing sends the submitted text and category/account labels to Google.
Suggestions send the request plus category labels, rounded remaining balances
and unpaid bill reservation totals, with temporary category aliases. No full
transaction history, bank account balances, partner identities or bill titles
are sent for suggestions. This reduces disclosure; it is not a guarantee of
anonymity. Google's unpaid-service terms prohibit sensitive/confidential/personal
input and allow product improvement/human review. Use non-sensitive inputs or
an appropriate paid data-processing arrangement for identifiable finance data.
See [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing),
[rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and
[data terms](https://ai.google.dev/gemini-api/terms).

The `/api/ai` endpoint is protected by the existing sign-in middleware and does
not write finance records. Alerts and background Gemini jobs are not included.
