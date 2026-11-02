# Financial read mirror

The Notion/Supabase path keeps durable financial records in Notion and uses Supabase PostgreSQL for the read mirror and coordinated saves. See [migration and recovery](notion-supabase-migration.md). The earlier Neon-backed authority and temporary direct-read recovery mode are historical configurations.

The app reads an atomic Postgres snapshot of Notion while mutations and budget
validation continue to use live Notion. It is a read mirror, not a new authority
for writes. The `pg` adapter works with Supabase and other Postgres providers.

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
  import after a 15-second formula-settling window (`WRITE_SETTLE_MS`; two seconds published pre-write rollup balances). The existing delayed balance
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


## Shared-database quota failure

A PostgreSQL `53000` error explicitly reporting an exceeded quota is a provider availability failure. Balance-check and monthly-summary reads return HTTP 503 with `DATABASE_QUOTA_EXCEEDED` and `retryable: false`. The client surfaces the cause and does not immediately repeat the same failed monthly request. Manual Retry still performs a new read after access is restored. Other transient 429/5xx responses retain the existing retry behavior.

The mirror can fall back to live Notion, but contribution agreements and unresolved balance checks are authoritative PostgreSQL records. Do not replace their read failures with empty agreements, zero debt, settled statuses or fabricated local records. Restoring the existing provider’s access preserves those records; migration requires copying the authoritative tables as well as any mirror data.

For Neon, inspect the project usage and billing period in the console. Compute/network allowance exhaustion may require waiting for the billing-period reset or changing plan; storage limits do not reset monthly. A database connection error alone does not identify the exhausted resource or reset time. See [Neon quota guidance](https://neon.com/faqs/free-plan-limits-and-quotas) and [billing management](https://neon.com/docs/introduction/manage-billing).

## Free direct-Notion recovery mode

Set server-only `FINANCE_NOTION_ONLY=true` and restart the server. This mode was used temporarily during the 31 October 2026 quota incident, before durable records were restored to Notion. It preserves `DATABASE_URL` and all existing records, makes no billing changes, and opens no PostgreSQL pools. The mirror, sync status checks and automatic imports are disabled. All database pool factories check the mode before opening or reusing a connection, including balance checks, contribution records, savings locks and operation tracking.

Notion display reads retain pacing, pagination and transient-failure handling. Monthly summary reads isolate contribution-agreement failure: valid assignments, spending and transactions return HTTP 200 with `summary.contributionError`, without a `contributionAgreements` field. A successful empty agreement read remains distinct from an unavailable read. The web and native contribution calculations return unknown rather than recalculating agreed targets. Planning and repayment capacity stay unavailable when repayment reserves cannot be verified.

| Read group | Authority | Direct mode |
| --- | --- | --- |
| Account ledger balances, categories, frozen/archived categories, work/income fields | Notion Accounts / Categories | Available |
| Activity, expenses, income and transfers | Notion Transactions | Available |
| Due bills and recurring schedules | Notion Transactions | Available |
| Pending items | Notion Pending | Available |
| Monthly spending, assignments and saved plan amounts | Notion Transactions / Funds | Available |
| Confirmed contribution agreements and revision history | PostgreSQL only | Explicitly unavailable |
| Unresolved actual-balance counts | PostgreSQL only | Explicitly unavailable |
| Planning capacity after dues and repayment reserves | Notion plus PostgreSQL obligations | Unavailable while agreements cannot be read |
| Save fences, cross-instance savings locks and operation receipts | PostgreSQL | Dependent saves paused before writing |

The same underlying readers power web, native snapshots/resources, MCP reports and Shortcut options. Authentication remains independent. Notion cannot return financial records that were never stored there; complete database independence requires an explicit migration of agreements and pending checks after those authoritative records are accessible. Do not manufacture a migration from inferred targets or conversation values.

Recovery is intentionally conservative about writes: `withMirrorMutation` refuses to bypass its existing durable invalidation fence, and database-dependent locks/receipts refuse to run. Some independent Notion actions can retain their existing behavior, but this recovery mode is not a promise that all saves work offline from PostgreSQL. Once access is restored, disable the flag and restart to resume ordinary shared-database operation.

Verification: live localhost Accounts, Categories and October monthly summary returned 200 with `X-Finance-Data-Source: notion`; the summary retained valid totals while explicitly flagging unavailable contributions. Balance checks and agreements returned non-retryable `DATABASE_NOTION_ONLY`, and sync returned configured=false. Tests assert that direct mode never constructs a PostgreSQL pool or executes a protected mutation; partial-read and contribution tests protect unknown-vs-zero behavior.


## Contribution agreement namespace

Legacy finance namespaces incorporate the Notion connection token. Rotating it can leave the same household's contribution agreements under the previous scope while live Notion account/category reads continue working. `FINANCE_CONTRIBUTION_SCOPE` can pin the verified existing 64-character scope for contribution reads, plan validation and agreement writes. All consumers use contributionScope; the default remains the existing token-derived namespace. Invalid configured values fail visibly.

Verify the database belongs to the same household and check existing agreement versions/targets before setting this value. This is a server-only configuration value, not an account identifier from a client request. It does not move or rewrite any financial record and does not change the namespaces used by the read mirror, balance checks, write fences or operation receipts. PostgreSQL continues to provide atomic agreement updates in production. Do not enable the local-only Notion writer on Vercel as a workaround.
