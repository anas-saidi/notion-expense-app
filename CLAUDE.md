# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npx tsc --noEmit   # Type-check without emitting (run before every commit)
```

There is no test suite. TypeScript (`npx tsc --noEmit`) is the primary correctness check — always run it after changes.

## Environment

The app requires a single env var for local dev:

```
NOTION_TOKEN=<internal integration token>
```

Copy `.env.example` to `.env.local` and fill it in. `NOTION_TOKEN` is the
server-side secret used for all data access to Notion's API and is unrelated
to sign-in.

Sign-in is gated separately via a **Notion OAuth "identity check"** — it only
answers "is this one of the two authorized people?" and never touches the
data layer. Additional env vars for this: `NOTION_OAUTH_CLIENT_ID`,
`NOTION_OAUTH_CLIENT_SECRET`, `APP_URL`, `SESSION_SECRET`,
`ALLOWED_NOTION_EMAILS` (see `.env.example`).

`NOTION_TRANSACTIONS_DB` / `NOTION_CATEGORIES_DB` / `NOTION_ACCOUNTS_DB` must
be left **unset**, not set to an empty string — every route falls back to a
hardcoded default DB ID via `?? "..."`, which only triggers on `undefined`.
An empty-but-present env var overrides the default with `""` and breaks
every Notion API call in that route.

## Architecture Overview

**Auth gate.** `middleware.ts` runs on every request (excluding static
assets) and checks a signed `session` JWT cookie (`lib/auth.ts`, via `jose`
— Edge-compatible). Missing/invalid session → redirect to `/login` for
pages, `401 JSON` for `/api/*`. `/login` and `/api/auth/*` are the only
public paths. Sign-in itself goes through Notion OAuth
(`/api/auth/login` → `/api/auth/callback`), checked against
`ALLOWED_NOTION_EMAILS`; the resulting session cookie is purely an identity
gate and never touches `NOTION_TOKEN` or the data layer.

**Single-page client app backed by Next.js API routes.**

`app/page.tsx` is the entire frontend. It is one large `"use client"` component that:
- Fetches all data (categories, accounts, transactions, pending items) on mount and on month change
- Holds all UI state: active tab, open sheets, form values, selected month
- Passes data and callbacks down to screen/sheet components — no global state library

**Tabs** (`AppTab = "home" | "plan" | "budget" | "history"`) switch between:
- `HomeScreen` — overview with budget sliders and spend summary
- `CategoriesScreen` — category budget list with donut chart
- `InsightsScreen` — monthly spend breakdown charts
- `MonthlyPlanningFlow` — guided month-close/open workflow

**Sheets** are full-screen or bottom-sheet overlays controlled by boolean state in `page.tsx`:
- `AddTransactionSheet` — add/edit expense, with quick-fund flow
- `CategoryDetailsSheet` — category drill-down (transactions + fund/move actions)
- `AccountDetailsSheet` — account drill-down (running balance chart per month)
- `ManageScreen` — account list with balance donut; rendered as a portal-pushed screen
- `RebalanceSheet`, `AccountTransferSheet`, `AccountIncomeSheet` — money movement flows

## Notion Data Model

All persistence is Notion. API routes in `app/api/` are thin proxies — they authenticate with `NOTION_TOKEN` and call Notion's REST API directly.

**Notion DB IDs** are hardcoded in each route file (some also readable via `process.env.NOTION_*_DB`):

| Database | ID |
|---|---|
| Transactions | `1926a2be-8922-80be-968a-efa6e6dace95` |
| Categories | `1926a2be-8922-8029-9b90-c7d8bb55fabd` |
| Accounts | `1926a2be-8922-8014-bb54-d9f5e9d1234b` |
| Pending | `d2db101b-faec-467d-8c57-eee6d8780311` |
| Funds | `1936a2be89228058990dc549172f1d45` |
| Reconciliations | `30c6a2be-8922-80b5-b9d7-db4e707b2276` |

**Transaction types** (`Transaction.type`):
- `"Expense"` — standard spend; uses `accountId` + `category`
- `"Income"` — money in; uses `accountId`
- `"Transfer"` — budget rebalance or account move; uses emoji-named relation properties:
  - `💰 budget (in)` / `💰 budget (out)` → `toCategoryId` / `fromCategoryId`
  - `🏦 account ( in )` / `🏦 account ( out )` → `toAccountId` / `fromAccountId`

When filtering transactions for a specific account, always check both `t.accountId === id` (Expense/Income) **and** `t.fromAccountId === id || t.toAccountId === id` (Transfer).

## Key Utilities (`app/components/app-utils.ts`)

- `evalExpr(str)` — safe arithmetic parser (no `eval`); used for the amount input so users can type `50+30`
- `monthBounds(dateStr)` — returns `{ start, end }` for a "YYYY-MM" string
- `fmt(n)` — formats numbers in Moroccan locale (`fr-MA`) — currency is MAD throughout
- `getCategoryScope(category)` — derives `BudgetScope` ("joint" | "anas" | "salma") from category fields; falls back through owner → type → name heuristics
- `getBalanceByScope` / `getLeftToAssignByScope` — aggregate account balances by scope using label heuristics ("wife", "hubb", "joined")

## Design System

All styling is inline `CSSProperties` objects — no CSS modules, no Tailwind. `globals.css` defines CSS custom properties (tokens) only.

**Core tokens:**
- `--accent` / `--accent-ink` — primary green (`#9fe870` husband, `#86de66` wife)
- `--surface` / `--surface2` / `--bg` — layered backgrounds
- `--text` / `--text2` / `--muted` — text hierarchy
- `--danger`, `--success`, `--warning`, `--info` — semantic colors
- `--partner-husband` (`#6aa6e6`) / `--partner-wife` (`#e86c95`) — identity colors
- `--font-display` / `--font-body` — both resolve to Instrument Sans

**Mode** (`html[data-mode="husband|wife"]`) shifts `--accent` and `--bg` slightly. Set on `<html>` element.

**Touch targets**: minimum 44×44 px on all interactive elements (enforced manually per component).

**Donut charts** are hand-drawn SVG arcs using `polar()` + `arcPath()` helpers defined inline in each screen file (no chart library for donuts). Recharts (`ComposedChart` + `Area`) is used for line/area charts in `InsightsScreen` and `AccountDetailsSheet`.

## Component Conventions

**`PickerPopover`** — portal-based floating dropdown. On mobile (`< 600px`) it pins to `bottom: 8px` above the virtual keyboard instead of anchoring to the trigger chip. Pass `anchorRef` pointing to the trigger element for desktop positioning.

**`BottomSheet`** — wraps `react-modal-sheet`; always rendered via `createPortal` to `document.body`.

**`ui/icons.tsx`** — single re-export file for all lucide-react icons, defaulting to `size=18`. Import from here, not directly from `lucide-react`.

**Amount hero input** (`AddTransactionSheet`) uses a CSS grid size-mirror trick (`.amount-hero-sizer` in `globals.css`) so the input shrinks to text width and the cursor lands at the end of digits, not the visual center.

## API Route Patterns

- Most routes read `NOTION_TOKEN` from `process.env` and return early with a 500 if missing
- `GET /api/transactions` — when `start`+`end` query params are provided it paginates through all Notion results; without them it caps at `page_size` (default 10, max 100)
- `lib/notion-api.ts` — shared `notionFetchJson()` helper with retry logic (2 retries, exponential backoff, 15 s timeout); used by newer routes; older routes call `fetch` directly
- Notion "delete" is implemented as archiving (`{ archived: true }`) via PATCH, not a true delete
