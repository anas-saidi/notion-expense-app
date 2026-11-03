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

## Mirror read performance, 2026-11-03

Mirror requests now use the schema installed by tracked migrations. They never run `MIRROR_DDL`: even a redundant `ALTER TABLE ... IF NOT EXISTS` takes a table lock and can contend with reads/imports across cold workers. New environments must apply the migration before starting the app; unavailable tables follow the existing live-Notion display fallback. Tests install their schema explicitly.

Reports return individual PostgreSQL rows instead of building a nested `jsonb_agg` response in the database. One SQL statement still checks revision/freshness and reads the matching generation, preserving a consistent snapshot during publication or invalidation. Paginated queries retrieve one extra row to determine `has_more`; full reports remain unlimited. A left lateral join preserves the distinction between a valid empty result and a missing/stale snapshot.

Against the same valid production mirror, the previous full-history transaction read took 20,453 ms and the revised read took 2,050 ms from the development host. All 2,621 returned pages matched exactly. The earlier query plan spent most of its execution time aggregating/constructing the nested JSON response. Local sequential and concurrent checks of nine authenticated app endpoints returned HTTP 200 with mirror provenance and no contribution errors. The full monthly summary took 2,658 ms sequentially and 3,048 ms concurrently. These are local measurements, not device or hosted latency guarantees.

Validation: 629 regression tests passed; five opt-in live integration tests were not rerun for this read-query change. Production build and type checks passed. Regression coverage includes empty results, pagination past the end, archived records, missing/invalid snapshots, and cold reads without schema mutations. No financial payloads, write coordination, TLS rules, namespace inputs, or freshness limits changed.

## First load after inactivity, 2026-11-03

A fresh-mirror benchmark does not cover opening the app after inactivity. The mirror expires after 15 minutes, while the Vercel Hobby cron in `vercel.json` runs daily. Reproduction against production returned live-Notion account data in 11,830 ms and the full monthly summary in 15,716 ms. This explains the ten-second loading recovery banner even though warm mirror reads were fast.

The tracked `20261103103000_schedule_mirror_refresh.sql` migration installs a Supabase job named `finance-mirror-refresh` every five minutes. It calls the existing canonical refresh endpoint independently of app visits. It still imports the complete Notion databases and publishes atomically through the existing lease and revision checks. It never extends the freshness limit, serves an invalidated snapshot, or bypasses write coordination. The daily Vercel job remains a redundant refresh. This uses the existing projects without a plan upgrade.

Supabase supports scheduled HTTP calls through [pg_cron and pg_net](https://supabase.com/docs/guides/functions/schedule-functions). Its database-owned HTTP queue can be read by database login roles. The job therefore sends a task-specific HMAC signature that expires after five minutes, rather than putting a reusable credential in that queue. The separate `FINANCE_MIRROR_REFRESH_SECRET` is stored in canonical production settings and encrypted Supabase Vault; browser roles cannot read Vault or execute the enqueue wrapper. The existing Vercel bearer authentication remains supported.

Setup after applying the migration:

1. Configure `FINANCE_MIRROR_REFRESH_SECRET` as a sensitive server-only setting on the canonical Vercel project and deploy the route that accepts signed refreshes.
2. Run `node --env-file=.env.local --env-file=/private/path/scheduler.env scripts/configure-mirror-refresh.mjs --apply`, using the same secret. Without `--apply`, the script only inspects configuration. It verifies the canonical endpoint before storing secrets and refuses another project or destination.
3. Verify `cron.job_run_details`, the matching `net._http_response` status and an advancing mirror `synced_at` after a scheduled run. Then measure a fresh browser session without first refreshing the mirror manually.

If the scheduler fails, the original bounded-freshness fallback still applies. Do not hide loading recovery or represent an expired snapshot as current. To disable only this job, use `SELECT cron.unschedule('finance-mirror-refresh')`; do not drop shared extensions or financial coordination tables. Rotate the dedicated secret in Vercel and Vault together when needed.

## Disk I/O amplification, 2026-11-03

A Supabase disk-I/O budget email identified this same project. Read-only PostgreSQL statistics showed the old publication query had executed 199 times, written 934,536 temporary blocks (about 7.65 GB) and generated 2,221,886,670 WAL bytes (about 2.22 GB). The current mirror held 3,342 records; its table counters showed 665,153 inserts, 661,811 deletes and 199 autovacuum runs. These are cumulative statistics, not a claim about the provider's remaining budget or a single-day billing period.

The five-minute warmup job amplified an existing full-replacement publisher. Its `jsonb_each`/`jsonb_array_elements` function scans materialized complete ledger JSON and spilled to temporary storage, while every refresh inserted/deleted records even when nothing changed in Notion.

Apply `20261103210000_reduce_mirror_publication_io.sql` before deploying the revised publisher. It adds nullable fingerprint metadata only. The current schema, read APIs, namespace, 15-minute freshness limit, write fences, lease ownership/expiry and revision checks remain. No financial records or coordination receipts are discarded.

Publication now pins one pool connection and commits head, schema, bounded 200-page INSERT VALUES batches and generation cleanup in one transaction. A failed batch rolls back the entire publication. There is no full-ledger JSON set-returning function and no history truncation or SQL parameter-count ceiling tied to ledger length.

A SHA-256 fingerprint of canonical content detects identical imports. Object key order and only each database schema response's top-level `request_id` are excluded; those IDs change per HTTP request and are transport metadata. Page contents, user-defined similarly named properties, formulas, schema fields and array order remain significant. A matching fingerprint renews freshness only after a complete live Notion import passes the existing fences. It preserves the generation and touches no record/schema rows.

The fingerprint is tied to the generation that it describes. An older deployment publishing a new generation without updating fingerprint metadata cannot cause a false unchanged result during rollout or rollback.

Live checks against all 3,342 records: a changed/full publication wrote zero temporary blocks; a subsequent verified unchanged import preserved identical content and generation, executed one publication statement, wrote zero temporary blocks and 329 WAL bytes. The first attempts exposed six changing schema `request_id` fields and a concurrent scheduled lease; the final check waited for the importer and passed. No Notion records were modified. To avoid an unnecessary seed rewrite during verification, a generation-checked metadata-only update described the existing cached generation without renewing its freshness.

Validation: 640 ordinary tests passed, 5 optional tests skipped; production build and types passed. Added coverage includes fingerprint stability, exact trace-field exclusion, unchanged refresh, lease/fence rejection, old-publisher compatibility, bounded complete batches, connection pinning and rollback after a partial batch. `npm test` now excludes ignored `.codex` operational scripts and build directories; live diagnostics/migrations require an explicit opt-in configuration.

Operational mitigation temporarily spaced `finance-mirror-refresh` to ten minutes using `cron.alter_job`, within the unchanged freshness limit. Direct locking of the extension-owned cron table was rejected and made no change; the supported job function succeeded. Restore the original five-minute schedule only after the optimized deployment is ready. No compute/billing changes, destructive maintenance or coordination-table cleanup were performed. Provider budget replenishment must be checked in Supabase Database Health; SQL counters do not expose that balance.
