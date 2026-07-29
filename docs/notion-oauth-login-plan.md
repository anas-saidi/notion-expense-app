# Notion Sign-In Gate — Implementation Plan

Status: **Implemented and verified** (2026-07-29) — `lib/auth.ts`, `middleware.ts`,
`app/api/auth/{login,callback,logout}/route.ts`, and `app/login/page.tsx` are in
place; end-to-end sign-in through Notion OAuth and the session gate on both
pages and API routes has been manually verified against a real Notion
integration.

## Why

`notion-expense-app` is a private household finance PWA used by exactly two
people (Anas and Salma). It is currently deployed with **zero
authentication** — `app/api/auth/[...nextauth]/route.ts` is a dead stub (no
`next-auth` package is even installed; both handlers just return 404), and
there is no `middleware.ts` anywhere in the project. Every one of the 15 API
routes under `app/api/*` (transactions, accounts, transfers, monthly
planning, etc.) and the single-page app itself are open to anyone who has
the URL.

We want the lightest possible fix that closes this gap for exactly two known
people. After weighing a shared-password gate, an email one-time-code, and
Notion OAuth, we chose **Sign in with Notion**, since both partners already
have Notion accounts.

Important constraint: this OAuth flow is used **only as an identity check to
gate access** — it must not replace or touch the existing data layer, which
continues to authenticate to Notion's API purely through the existing
shared `NOTION_TOKEN` internal-integration secret used in every route today.

## Approach

A Notion OAuth "Public" integration (no marketplace review needed — that's
only required to list it in Notion's directory) is used purely to answer
"is this one of our two Notion accounts?" On success we mint a
self-contained signed session cookie (JWT via `jose`, which works in both
the Edge middleware runtime and Node route handlers — `jsonwebtoken` does
not run on Edge). `middleware.ts` checks that cookie on every request and
gates both pages and API routes. No database, no session store, no token
refresh, no change to the existing husband/wife mode toggle.

### New dependency
- `jose` (JWT signing/verification, Edge-compatible) — the only new package.

### 1. `lib/auth.ts` (new)
Edge-safe shared helpers (no `Buffer`/`node:crypto` — use `jose` +
global `crypto.randomUUID()` only, since this file is imported by both the
Edge middleware and Node route handlers):
- Constants: `SESSION_COOKIE = "session"`, `STATE_COOKIE = "notion_oauth_state"`,
  `SESSION_MAX_AGE` (365 days), `PUBLIC_PATHS` (`/login`, `/api/auth/login`,
  `/api/auth/callback`, `/api/auth/logout`).
- `createSessionToken({ email, name, notionUserId })` → `SignJWT`, HS256,
  365d expiry, secret from `process.env.SESSION_SECRET`.
- `verifySessionToken(token)` → `jwtVerify`, returns payload or `null` (never
  throws) so callers treat "missing" and "invalid" identically.
- `isAllowedNotionIdentity({ email, id })` → parses `ALLOWED_NOTION_EMAILS`
  (comma-separated, trimmed + lowercased for human-entered env vars),
  falling back to comparing `id` against `ALLOWED_NOTION_USER_IDS` if no
  email is present in the OAuth response.

### 2. `middleware.ts` (new, project root)
- `config.matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.json|sw.js).*)"]`
  (matcher must be a static literal — the public-path allowlist logic lives
  in the function body, reusing the `PUBLIC_PATHS` array from `lib/auth.ts`).
- If path is public → `NextResponse.next()`.
- Else verify the `session` cookie via `verifySessionToken`:
  - `/api/*` and invalid/missing → `401 JSON`.
  - anything else and invalid/missing → redirect to `/login`.
  - valid → `NextResponse.next()`.

### 3. Replace the dead auth stub
Delete `app/api/auth/[...nextauth]/route.ts` (folder name is misleading now
— there's no `next-auth`). Add three route handlers, each with
`export const runtime = 'nodejs'` (the default anyway, but explicit so a
future project-wide Edge default can't silently break OAuth):

- **`app/api/auth/login/route.ts`** — builds
  `https://api.notion.com/v1/oauth/authorize` URL (`client_id`,
  `response_type=code`, `owner=user`, `redirect_uri` built from `APP_URL`),
  generates a `state` via `crypto.randomUUID()`, sets it as `STATE_COOKIE`
  (10 min, httpOnly, `sameSite: "lax"`, secure in prod, `path: "/api/auth"`),
  redirects.
- `SESSION_COOKIE` is set with `maxAge: SESSION_MAX_AGE` (365 days) — a
  persistent cookie, not a browser-session-only one, so it survives closing
  the PWA/app or restarting the phone. On iOS Safari this matters
  specifically: ITP caps client-JS-set cookies (`document.cookie`) at 7
  days, but that cap does **not** apply to cookies set via a server
  `Set-Cookie` response header, which is what this flow does — so the
  home-screen PWA stays logged in for the full year, not silently capped at
  a week.
- **`app/api/auth/callback/route.ts`** — reads `code`/`state` from the query
  string, verifies `state` against `STATE_COOKIE` (clear the cookie either
  way), exchanges `code` at `POST https://api.notion.com/v1/oauth/token`
  (`Authorization: Basic base64(client_id:client_secret)`, JSON body
  `{ grant_type: "authorization_code", code, redirect_uri }`), reads
  `owner.user` (`id`, `name`, `person.email` if the integration's "User
  information with email addresses" capability is enabled), calls
  `isAllowedNotionIdentity`. On success: sign a session token, set
  `SESSION_COOKIE` (httpOnly, `sameSite: "lax"`, secure in prod, 365-day
  maxAge), redirect to `/`. On failure: redirect to `/login?error=not_allowed`,
  no cookie set.
- **`app/api/auth/logout/route.ts`** — clears `SESSION_COOKIE`, redirects to
  `/login`.

### 4. `app/login/page.tsx` (new)
Minimal screen styled with the existing CSS custom properties from
`app/globals.css` (per `docs/design-system.md`: `--bg`/`--surface` surfaces,
`--action` cobalt for the primary CTA since this is a decision the user must
make, `--text`/`--muted` for copy). Reads `searchParams.error` to show "Not
an authorized account" when `error=not_allowed`. One link/button styled as a
button: `href="/api/auth/login"`, "Continue with Notion."

### 5. `public/sw.js` (modify)
Bump `CACHE_NAME` to `"expense-app-v2"` — the existing `activate` handler
already purges old-versioned caches, so this forces any client with a
pre-auth cached `/` shell to drop it on next service-worker update. API
routes and non-GET requests are already excluded from the cache (line 24),
so this is the only SW change needed.

### 6. `.env.example` (modify)
Keep `NOTION_TOKEN` and DB ID vars untouched; append a new section:
```
# ─── Sign-in gate (Notion OAuth, identity-only — does not touch data) ──
NOTION_OAUTH_CLIENT_ID=
NOTION_OAUTH_CLIENT_SECRET=
APP_URL=http://localhost:3000
SESSION_SECRET=            # openssl rand -base64 32
ALLOWED_NOTION_EMAILS=     # comma-separated, case-insensitive
```

### 7. `README.md` (modify)
Replace the existing (abandoned, `next-auth`-flavored) "Create a Notion
OAuth App" section and env var table with the corrected flow: integration
type "Public", redirect URI is now `/api/auth/callback` (no `/notion`
suffix — that was a `next-auth` convention, unused here), a note to enable
"User information with email addresses" capability on the integration, and
the renamed env vars above (`NOTION_OAUTH_CLIENT_ID`/`_SECRET`, `APP_URL`,
`SESSION_SECRET`, `ALLOWED_NOTION_EMAILS`) in place of `NEXTAUTH_*`.

### 8. `CLAUDE.md` (modify)
Update the "Environment" section (currently says the auth route is an
unused stub) and add a short line under Architecture describing the
middleware gate, so future sessions don't reintroduce the "no auth"
assumption.

## Key mechanics confirmed

- Middleware is Edge-only in Next 14 → `jose` is the correct (only viable)
  JWT library there.
- `sameSite: "lax"` is required (not just safer) on both the state and
  session cookies — Notion's redirect back to the callback is a top-level
  cross-origin GET navigation, and `Strict` would drop the state cookie.
- A "Public" Notion integration works for a 2-person allowlist without any
  Notion review — review is only needed to list it in their public
  directory.
- The OAuth access token is read once for `owner.user` and discarded —
  never stored, never reused — so there's no refresh/revocation surface.
- Session length is 365 days (persistent cookie, not browser-session-only)
  — for two trusted personal devices, this means "log in once, stay logged
  in." There's no server-side session store, so if a device is ever lost or
  a session needs to be force-invalidated, rotating `SESSION_SECRET` in the
  env invalidates every existing session at once (everyone just logs back
  in via Notion). `/api/auth/logout` remains available for a normal
  voluntary sign-out.

## Verification (once implemented)

1. `npx tsc --noEmit` — must pass clean.
2. `npm run dev`, visit `/` while logged out → redirected to `/login`.
3. `curl -i http://localhost:3000/api/transactions` with no cookie → `401`.
4. Click "Continue with Notion" → complete Notion consent → redirected to
   `/` with a `session` cookie set; app loads normally.
5. Try logging in with a Notion account *not* in `ALLOWED_NOTION_EMAILS` →
   redirected to `/login?error=not_allowed`, no cookie set.
6. Visit `/api/auth/logout` → cookie cleared → next `/` load redirects to
   `/login` again.
7. Confirm the PWA still installs/loads correctly on iOS Safari after the
   `sw.js` cache-version bump (add to home screen, cold-launch once logged
   in).

## Going to production — what changes from local dev

Everything below was set up and verified against `http://localhost:3000`.
Deploying to a real domain (e.g. Vercel) requires these deltas:

1. **Add the production redirect URI to the Notion integration.** In the
   "Expense Tracker Sign-In" Public integration's OAuth Domain & URIs tab,
   add `https://YOUR-PROD-DOMAIN/api/auth/callback` alongside the existing
   `http://localhost:3000/api/auth/callback` — both must stay listed, one
   per environment.
2. **Set `APP_URL` to the production URL** (no trailing slash) in the
   hosting provider's env vars — this is what `login/route.ts` and
   `callback/route.ts` build the redirect URI from. If it still points at
   `localhost:3000` in prod, the OAuth redirect will send Notion's callback
   to the wrong host and it will fail.
3. **Generate a fresh `SESSION_SECRET` for production** — don't reuse the
   local dev value. `openssl rand -base64 32`. Whoever holds the local dev
   secret should not be able to forge production session cookies.
4. **Set `NOTION_OAUTH_CLIENT_ID` / `NOTION_OAUTH_CLIENT_SECRET`** in the
   hosting provider's env vars (same values as local dev — it's the same
   Notion integration, just a second redirect URI).
5. **Set `ALLOWED_NOTION_EMAILS`** in the hosting provider's env vars (same
   two emails as local dev).
6. **Set `NOTION_TOKEN`** in the hosting provider's env vars. Leave
   `NOTION_TRANSACTIONS_DB` / `NOTION_CATEGORIES_DB` / `NOTION_ACCOUNTS_DB`
   **unset** unless pointing at different databases — see the gotcha in
   `.env.example` and `CLAUDE.md` (an empty-but-present value overrides the
   hardcoded default and breaks every Notion call).
7. **Nothing to change for cookie `secure` flags** — every `Set-Cookie` in
   this codebase already checks `process.env.NODE_ENV === "production"`,
   which the hosting provider sets automatically at build/runtime. Just
   confirm the deployment actually serves over HTTPS (Vercel does this by
   default), since a `secure` cookie is silently dropped by the browser over
   plain HTTP.
8. **Re-run the verification checklist above against the production URL**
   once deployed, especially steps 4–6 (full OAuth round trip, rejected
   non-allowlisted account, logout).
