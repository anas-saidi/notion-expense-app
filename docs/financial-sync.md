# Financial read mirror

The app reads an atomic Postgres snapshot of Notion while mutations and budget
validation continue to use live Notion. It is a read mirror, not a new authority
for writes. Neon Free is the selected hosted option; the `pg` adapter also works
with other Postgres providers.

## Enable

1. Create a Neon project on **Free**, preferably near the Vercel function region.
2. Configure its pooled, TLS-enabled connection string as server-only
   `DATABASE_URL` locally and on Vercel. Do not place it in a `NEXT_PUBLIC_` variable.
3. Set a separate `CRON_SECRET`. Enable Fluid compute so background `waitUntil`
   work can use the route's bounded 240-second duration on the free deployment.
4. Apply `db/migrations/001_finance_mirror.sql` if the app role cannot initialize
   tables. Otherwise the first mirror operation initializes them automatically.
5. Seed via `GET /api/sync/refresh` with `Authorization: Bearer <CRON_SECRET>`.
   This endpoint verifies its own scheduler credentials. `/api/sync` uses the
   normal app session and exposes no connection credentials or raw snapshots.
6. Confirm read response headers: `X-Finance-Data-Source: mirror` and
   `X-Finance-Synced-At`. The app displays that import timestamp and **Sync now**.

The local workspace is connected to a Neon Free project, and a full import has
been verified. Deployment environment variables and deployed sync still need to
be configured before these changes reach the hosted app.

## Freshness and recovery

- A sync reads all pages from Accounts, Categories, Transactions, Funds, and
  Pending, including their schemas. Publication replaces all five databases
  atomically. A failed/partial import never overwrites the last complete snapshot.
  Full replacement picks up archived/deleted records and Notion formula changes.
- Reads older than one minute schedule a background import while serving the
  existing snapshot. Snapshots older than `FINANCE_MIRROR_MAX_AGE_SECONDS`
  (default 900), missing snapshots, database outages, invalidated snapshots, and
  unsupported query operators use live Notion reads. No process-memory financial
  fallback is represented as a durable mirror.
- Normal data reloads use the mirror. **Sync now** waits for a new import then
  reloads app data. It does not pretend that importing Notion itself takes zero
  time. The fast path applies to populated, valid mirror reads.
- App mutations create a durable write fence before touching Notion. If the fence
  cannot be persisted, saving returns 503 without writing. Overlapping saves
  retain independent fences. Successful and failed write attempts invalidate the
  snapshot; writes can have partially succeeded even when an API response fails.
- An importer can publish only if its lease and captured revision still match and
  no write fence remains active. Writes close their fences and schedule another
  import after a two-second formula-settling window. The existing delayed balance
  recheck remains. Reads during this window use Notion; post-save refresh speed is
  intentionally limited by live verification rather than stale snapshots.
- Sync leases expire after four minutes; abandoned write fences after five.
  New imports can recover after a killed function. No automatic page-create
  retries were introduced. Failed background work leaves a visible old timestamp
  and can be retried with **Sync now**.
- Schemas and individual records are stored separately under a generation ID.
  Publishing schemas, records, and the current generation is one SQL transaction;
  rejected imports do not change any records, and old generations are removed
  atomically. Queries avoid decompressing an entire financial snapshot per read.
  Postgres filters and paginates recent reads before transferring records. Full
  reports retrieve all matching rows in one database statement, so a concurrent
  publication cannot change a report halfway through. Unsupported Notion filters
  use the live implementation.
- Cron runs daily, matching free-tier scheduling constraints. Active reads and
  app writes also trigger sync. Each process coalesces sync tasks; Postgres leases
  coordinate separate function instances. Notion request pacing is process-wide,
  and Retry-After remains authoritative across separate instances.

## Public-app rebuild

Current authentication and `NOTION_TOKEN` represent one private household. Do not
open the app to public signups with that configuration. The reusable parts are the
storage adapter, query evaluator, import worker, write fencing, and freshness UI.

Mirror keys hash the connection token and normalized database configuration;
raw credentials are never persisted in snapshot rows. Tests verify namespace
isolation. This is connection isolation for today's app, not public-app tenancy.
A public version needs explicit household/workspace IDs and membership checks,
encrypted per-connection credentials, tenant-scoped authorization on every read
and mutation, and tenant-aware jobs. Rotate the hashed connection scope to an
internal connection ID under that authorization model.

Keep the Postgres storage boundary independent of UI and Notion transport. As
public usage grows, add property indexes to normalized records, use webhook-driven
incremental imports plus reconciliation sweeps, and move durable sync work to a
job runner. Define data deletion/export and connection-revocation behavior before
launch. Existing private local-storage draft/preferences must also become
user/household scoped. These are future launch requirements, not completed work.

## Validation

`npm test` includes embedded Postgres integration tests for snapshot publication,
connection isolation, stale reads, distributed leases, overlapping writes,
abandoned-fence recovery, default-live budget checks, and refusal to write when
invalidation fails. Query tests cover more than 100 rows, combined bill queries,
and unsupported operators. Production builds and browser comparisons exercise the
same API routes; local embedded Postgres is a test backend, not a hosted Neon
latency guarantee.
