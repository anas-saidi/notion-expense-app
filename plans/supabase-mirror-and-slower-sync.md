# Move the read mirror to Supabase and slow down re-imports

Goal: reads come from a Postgres mirror again (fast), hosted on Supabase Free, and the mirror stops re-importing all of Notion on nearly every visit, which is what used up Neon's free compute.

## Context the agent needs

- Notion stays the source of truth. Durable records (agreements, balance checks, operation receipts, savings locks) already live in Notion Finance Records whenever `NOTION_FINANCE_RECORDS_DB` is set. See `lib/contribution-store.ts:52`, `lib/balance-check-store.ts:41`, `lib/savings-funding-lock.ts:9` and `lib/mcp/operations.ts`.
- With that variable set, `DATABASE_URL` only turns on the **read mirror** (`lib/mirror/*`). Supabase therefore holds a disposable copy. If it is lost, the next sync rebuilds it.
- Do not migrate anything from Neon. Neon only held mirror data and the older Postgres records, and those were already recovered into Notion (`docs/notion-finance-records.md`).
- The mirror store uses lease rows, not advisory locks or `LISTEN`, so a connection pooler is fine.

## Why Neon ran out

Three hard-coded 60-second thresholds:

| Where | What it does |
|---|---|
| `lib/mirror/context.ts:27` | Any mirror read older than 60 s schedules a full sync |
| `app/api/sync/route.ts:12` | The sync status check does the same |
| `lib/mirror/sync.ts:18` | The cooldown between syncs is 60 s |

Each sync is a full, paginated re-import of five Notion databases plus an atomic replace. That keeps the database awake for minutes on every app open, and Neon bills compute hours.

## Part 1: Point the mirror at Supabase (config only)

1. The user creates the Supabase project. Do not create accounts or enter credentials yourself. Ask for:
   - the region closest to the Vercel function region
   - the **Session pooler** connection string (`aws-0-<region>.pooler.supabase.com:5432`)
   
   Use session mode, not the transaction pooler on port 6543, because `lib/mirror/store.ts:54` passes `statement_timeout` as a connection startup parameter.
2. Apply `db/migrations/001_finance_mirror.sql` in the Supabase SQL editor, or let the first mirror operation create the tables.
3. Environment, both in `.env.local` and on Vercel. Have the user paste secrets into Vercel themselves.
   - `DATABASE_URL` = the Supabase session pooler URL, with `?sslmode=require` if it isn't already there.
   - Keep `NOTION_FINANCE_RECORDS_DB` set, so durable stores stay on Notion.
   - `FINANCE_NOTION_ONLY` must be unset or `false`, otherwise the mirror stays off (`lib/mirror/store.ts:50`).
   - Remove the old Neon `DATABASE_URL`. Do not delete the Neon project; leave that to the user.
4. Seed the mirror: `GET /api/sync/refresh` with `Authorization: Bearer $CRON_SECRET`.
5. The existing daily cron in `vercel.json` (`/api/sync/refresh` at 03:15) also keeps the project from hitting Supabase Free's 7-day inactivity pause. Leave it as is.

## Part 2: Slow down background re-imports (small code change)

1. In `lib/mirror/context.ts`, next to `mirrorMaxAgeMs()`, add one helper with the same shape:
   ```ts
   export function mirrorRefreshMs() {
     const seconds = Number(process.env.FINANCE_MIRROR_REFRESH_SECONDS ?? 600);
     return (Number.isFinite(seconds) && seconds > 0 ? seconds : 600) * 1000;
   }
   ```
2. Replace the three hard-coded 60 s values with `mirrorRefreshMs()`:
   - `lib/mirror/context.ts:27`
   - `app/api/sync/route.ts:12`
   - `lib/mirror/sync.ts:18` (the cooldown)
3. Leave unchanged:
   - Write-triggered syncs (`settle = true`), so the app still re-syncs about 15 s after every save.
   - **Sync now** (`force = true`), which bypasses the cooldown.
   - Write fences.
4. Raise how long a stale snapshot is still served: set `FINANCE_MIRROR_MAX_AGE_SECONDS=86400` in env (no code change). With the 900 s default, almost every app open after a quiet spell falls back to slow live-Notion reads. The longer value is safe because app writes already invalidate the snapshot. The only thing a stale read can miss is an edit made directly in Notion, and the `Synced at` label plus **Sync now** cover that.
5. Document both variables in `.env.example` and update the "Freshness and recovery" section of `docs/financial-sync.md`. Drop the "older than one minute" wording.
6. Add one test beside the existing mirror tests: a read with a snapshot 2 minutes old does not schedule a sync, and one 11 minutes old does.

## Verify

- `npm test` passes.
- Run `npm run dev` on :3001 and open Home. The response headers show `X-Finance-Data-Source: mirror` and a recent `X-Finance-Synced-At`.
- Reload Home several times within 10 minutes. No new sync runs (check server logs or the `synced_at` timestamp).
- Add an expense. A sync runs about 15 s later, and the new expense appears from the mirror.
- **Sync now** still forces an import right away.
- In the Supabase dashboard (Reports, then Database), the size is a few MB and egress is in the MB range per day.

## Out of scope

- Moving durable records from Notion to Supabase.
- Supabase Auth, Storage or Realtime.
- Incremental or webhook-based imports.
- Changing the cron schedule.
