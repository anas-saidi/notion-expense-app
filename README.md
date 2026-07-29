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
| `NOTION_OAUTH_CLIENT_ID` | From your Notion OAuth app |
| `NOTION_OAUTH_CLIENT_SECRET` | From your Notion OAuth app |
| `APP_URL` | Your Vercel URL e.g. `https://myapp.vercel.app` (no trailing slash) |
| `SESSION_SECRET` | Run: `openssl rand -base64 32` |
| `ALLOWED_NOTION_EMAILS` | Comma-separated list of the two allowed Notion account emails |

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
