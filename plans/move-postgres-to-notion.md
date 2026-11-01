# Move Postgres-only data into Notion

Goal: the app runs with no `DATABASE_URL`. Nothing durable is lost, and duplicate-write protection stays at a level that fits a two-person household.

## What moves, and to what

| Today (Postgres) | Used by | Becomes (Notion) |
|---|---|---|
| `finance_contribution_agreements` + `_history` | monthly summary, contribution confirm, planning save, advance reservation | **Contribution Agreements** database, one page per revision |
| `finance_balance_checks` | Home balance checks, account details | **Balance Checks** database, one page per revision |
| `finance_mcp_operations` | MCP writes, iOS native writes (`/api/native/operations`) | **Operations** database, one page per request ID |
| `pg_try_advisory_lock` in `savings-funding-lock.ts` | savings deposit and undo | a short-lived claim page in **Operations** plus an in-process lock |
| `finance_mirror*` (copy of Notion) | display reads | removed; reads go to Notion live (the existing fallback when `DATABASE_URL` is unset) |
| `FINANCE_NOTION_ONLY` recovery flag | everything above | removed; not needed once nothing depends on Postgres |

## How each piece works

### One shared helper: `lib/notion-ledger.ts`

- **Revisions (append-only).** A save never edits a page. It creates a new page with `Version` and `Replaces` (the version it was based on). The current record is the newest revision that no other revision replaces, so history comes for free.
- **Conflicts.** Save = read current, compare with the expected version, create the new page, then re-read. If another revision replaces the same version and was created first, archive ours and return the existing 409 ("changed on another device").
- **Claims (for request IDs and locks).** Create a claim page keyed by the request ID, then re-read. The earliest claim wins; a later one archives itself and fails. Lock claims expire after 2 minutes so a crashed request can't block forever.
- **JSON values** that may be long (balance-check transaction IDs, operation results) are split across rich-text chunks.

### Contribution agreements
- Properties: Month (title), Version, Replaces, Anas target, Salma target, Anas share, Salma share, Original Anas, Original Salma, Confirmed at.
- `ContributionStore.list/save` keep their signatures, so the routes and `contribution-service.ts` don't change.
- **Paused until migrated:** the existing agreements sit in Neon, which is unreachable until the quota resets. Until the migration script has run, confirming or editing an agreement stays paused (as it is today), so Notion never gets a record that conflicts with the one still in Neon.

### Balance checks
- Properties: Account ID (title), Version, Replaces, Closed, Actual balance, Ledger balance, Checked at, Checked day, Known transactions (chunked).
- `BalanceCheckStore.list/save/close` keep their signatures. Open checks in Neon are not migrated (they are short-lived); anyone with an open check redoes it.

### Operations (MCP + iOS native writes)
- Properties: Request ID (title), Scope, Fingerprint, State (pending / completed), Result (chunked JSON), Finished at.
- `McpOperations.once` keeps its contract: same request ID with different inputs is rejected, a pending or unknown outcome is never retried automatically, a completed one returns its saved result.

### Savings funding lock
- An in-process lock (same instance) plus a claim page (across instances), released when the deposit finishes.
- The deposit's own operation-ID recovery protocol in `notion-savings-funding.ts` is unchanged.

## Known limits (be honest about these)

- **Not as strict as Postgres.** Notion has no atomic compare-and-set, and a database query can lag a few seconds behind a page that was just created. Create-then-verify catches most races, not all: two saves of the *same* record from two devices within a few seconds of each other could both succeed. Acceptable for two people; if it ever bites, the fix is a free Redis tier (Upstash) used only for locks.
- **Slower saves.** Each protected save adds one or two Notion calls (about 0.5–1s).
- **Slower first loads.** Without the copy of Notion, Home's first load is about 7s (measured today in Notion-only mode); the in-memory caches make later loads faster. Speeding up the remaining reads is a separate follow-up.

## Setup and migration

1. `scripts/create-notion-ledger.ts`: creates the three databases next to the Transactions database (same parent page) and prints `NOTION_CONTRIBUTIONS_DB`, `NOTION_BALANCE_CHECKS_DB`, `NOTION_OPERATIONS_DB` to add to `.env.local` and Vercel. The Notion integration needs "insert content" on that parent page.
2. `scripts/migrate-postgres-to-notion.ts`: run once Neon is reachable again. Copies every agreement revision (oldest first) and lists any operation still `pending` for a manual check. Then contribution editing un-pauses.
3. Remove `DATABASE_URL` and `FINANCE_NOTION_ONLY` from `.env.local` and Vercel.

## Order of work

1. `lib/notion-ledger.ts` + tests (revision conflicts, claim winner, lock expiry, chunking).
2. Balance checks on Notion.
3. Operations ledger + savings lock on Notion.
4. Contribution agreements on Notion, paused until migrated.
5. Setup and migration scripts.
6. Remove the Postgres code paths and the `FINANCE_NOTION_ONLY` flag; update README, `docs/financial-sync.md`, `docs/monthly-contribution-agreements.md`, `ios/README.md`.
7. Run the setup script, the full test suite and the app locally with no `DATABASE_URL`.

Removing the mirror code itself (`lib/mirror/*`, ~400 lines) is a follow-up once this has run for a while; with no `DATABASE_URL` it is inert.
