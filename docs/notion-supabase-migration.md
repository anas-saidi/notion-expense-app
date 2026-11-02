# Notion authority and Supabase coordination

Notion remains authoritative for accounts, categories, transactions, funds, pending items, contribution agreement revisions and balance checks. Supabase stores a rebuildable projection plus durable write guards, acknowledged Notion page identities and duplicate-operation claims. Those coordination tables are not a disposable cache.

## Configuration

- `NOTION_FINANCE_RECORDS_DB` selects the existing Finance Records database. Preserve household namespaces and `FINANCE_CONTRIBUTION_SCOPE`.
- `DATABASE_URL` uses the Supabase transaction pooler for mirror queries.
- `FINANCE_COORDINATION_DATABASE_URL` uses the Supabase **session** pooler on port 5432, preserving session advisory locks through each Notion operation. Never use transaction pooling for coordination.
- Disable `FINANCE_NOTION_ONLY` for normal operation. Recovery mode disables both mirror and coordinator connections. The old `NOTION_SINGLE_WRITER=true` path remains available only for one local server; it must not run concurrently with production writers.
- Server-only connection strings never reach the browser. Supabase's public root certificate is compiled into the database TLS helper, which verifies both the certificate and hostname. Browser roles have no grants or RLS policies for finance tables.

Apply the tracked Supabase migration before enabling the configuration. The existing driver and application authentication remain unchanged.

## Save and read behavior

1. Acquire the household's session lock and persist a guard before Notion side effects. Nested operations reuse the held session. A second process gets a conflict before writing.
2. Invalidate the mirror before a protected operation. Validation reads live Notion. After completion, close the fence and schedule import after the existing formula-settling delay.
3. Notion stores the full financial revision. Supabase records its page identity; when Notion query indexing lags, another worker retrieves the acknowledged page by ID from Notion. SQL does not invent a replacement financial payload. Archived pages are excluded.
4. MCP/native operations retain SQL request claims plus the existing Notion receipt and cutover checks. Unknown outcomes never automatically execute again under a new request identity.
5. A killed worker or failed acknowledgement leaves an interrupted-save guard. Do not clear it by age. Reconcile Notion activity and operation receipts first, then resolve the exact guard. Ordinary reads can remain available while affected writes are blocked.
6. Atomic imports include Finance Records alongside the five original databases without changing legacy namespace hashing. Mirror read failures fall back to supported Notion reads. Coordination failures block protected writes; they cannot safely be ignored as cache outages.

## Source history and rollback

The legacy Neon project remains intact. On 2026-11-02 management API access succeeded, but SQL reads still failed with quota error 53000. Full old SQL revisions and operation history have **not** been recovered. Existing Notion recovery checkpoints and their conservative operation cutoff remain in force; do not label old history recovered or replay old queued requests.

Current Notion records were exported to a restricted, ignored backup before cutover. Existing agreements and checks were preserved. Live write verification used generated `qa:*` checkpoints only; those test pages were archived afterward. No real agreement or balance count was rewritten to test the migration.

Rollback uses the retained previous Vercel deployment and configuration backup. Do not remove Neon, discard operation receipts, overwrite newer Notion revisions, or switch a live writer back to the uncoordinated local mode.

## Verification

- 627 unit/regression tests passed, including the coordinator's hot-reload context; five opt-in live integration tests passed separately.
- Real Supabase: separate Node processes serialize the same household; killed workers retain a write barrier; the anonymous browser role cannot read finance tables.
- Real Notion/Supabase: fresh ledger instances preserve revision lineage even when query results are deliberately hidden to simulate indexing lag; stale versions are rejected. Synthetic checkpoints were archived after testing.
- Combined SQL/Notion operation receipts return completed results without re-executing and retain uncertain requests without replay. Synthetic operation records and SQL test rows were cleaned up.
- Local authenticated APIs return the existing contribution agreement and balance checks. A seeded mirror and a deliberately unreachable mirror returned matching November totals; the latter used live Notion without the legacy quota error.
- Production build and type checks passed. Deployment verification is recorded below when cutover completes; local tests alone are not evidence of a production migration.

## Production cutover verification, 2026-11-02

The canonical `https://notion-expense-app.vercel.app/` deployment on main passed authenticated agreement, balance-check, monthly-summary and sync reads with HTTP 200 and no contribution/quota error. It returned the existing agreement and active balance check. Hosted preview reads also confirmed `X-Finance-Data-Source: mirror` and a current sync; deliberate mirror failure was separately verified against local production builds with matching Notion totals.

All five original Finance Records payloads were verified unchanged after the tests. Only generated QA metadata was created and archived. The original Neon deployment/database is retained for rollback and history recovery; inaccessible SQL history is still unresolved.

Older local servers owned by this session were stopped. The atlas-dev server on port 3001 remained running, so its existing environment was backed up and only `NOTION_SINGLE_WRITER` was changed to false. A harmless invalid expense request verified it returns the single-writer 503 before any save. The coordinated development preview runs from the migration checkout on port 3000.

The explicit `.vercelignore` excludes local credentials, migration backups, agent scratch files and build output. An earlier disposable CLI preview that included local scratch files was removed; deployment dry-run verification confirms those paths are excluded. Existing production credentials unrelated to storage were preserved. No billing settings were changed.
