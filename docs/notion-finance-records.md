# Durable finance records in Notion

The local preview now uses [Finance Records](https://app.notion.com/p/40a6a2be8922810aa757cede68c397e1) alongside the existing Notion Accounts, Categories, Transactions, Funds and Pending databases. PostgreSQL is not active in the local environment. No paid plan was enabled.

## Stored records

One database stores agreement revisions, actual-balance checks, operation receipts and recovery checkpoints. Scope, Kind, Key, Version, Replaces and State identify each immutable revision; Payload holds its full JSON. Large payloads use lossless rich-text chunks below the API's text limit. Numeric agreement/count projections make the records easier to inspect in Notion.

- Agreements preserve original targets and confirmation metadata when revised. Version checks reject stale edits. Multiple heads, duplicate versions, cycles or missing parents fail visibly rather than selecting a financial value silently.
- Balance checks retain their transaction cutoff and counted IDs. Closing appends a closed revision. Recovery records with an unknown cutoff use Review and are excluded from actual-funds estimates until a fresh count replaces them.
- Operation receipts are written pending before the action. Completed receipts return the original result; unknown outcomes and pending receipts never automatically execute again. A failed receipt save leaves the pending claim visible.
- Reads must succeed against Notion. A bounded process overlay supplies read-your-write consistency after successful queries; it is not an outage fallback or the durable authority.

## Single-writer constraint

Notion is not a replacement for PostgreSQL atomic locks. All protected writes run through one configured app process and a shared, reentrant queue. `NOTION_SINGLE_WRITER=true` is required; Vercel environments are explicitly refused. Do not enable this mode on multiple workers or concurrent deployments. Agreement/count revisions, expense/income/rebalance guards, savings operations and repayments share this queue.

The local savings operation-ID recovery protocol and repayment IDs remain on their financial records. Notion operation receipts replace SQL receipts for MCP/native operations. Native submissions include the original draft creation time; MCP writes accept the same immutable `createdAt` metadata. Old queued actions whose SQL receipts cannot yet be checked are blocked by the durable recovery cutoff. This is intentional duplicate protection, not an invitation to generate a new ID/time for an uncertain old action.

Production/serverless writes need an actual single writer or equivalent coordination before enabling. The implementation does not claim distributed compare-and-set or locks from Notion create/query operations.

## Recovery performed on 31 October 2026

- The user-authorized October targets were restored: Anas 11,638.25 and Salma 6,266.75, using the live account shares 65%/35%. Recovery provenance states that the original confirmation timestamp and old revision history were unavailable; the restoration is a new known baseline, not an import of inaccessible history.
- The earlier Joined count of 494 was preserved as Review. Its original transaction cutoff is unknown, so no current actual-funds estimate is fabricated. Enter and confirm the current count through Check balances to replace it.
- A checkpoint explicitly records that older PostgreSQL revision history and operation receipts remain unverified. These were not discarded, guessed or declared empty.
- The old connection is inactive in the ignored local configuration for later recovery. Runtime reads/writes select Notion stores first and do not contact Neon.

## Setup and later history import

`node --env-file=.env.local scripts/setup-notion-records.mjs` previews the setup. Add `--apply` to create/reuse Finance Records under the existing finance parent and configure the single local writer. It creates a recovery checkpoint, not invented agreement/count defaults.

`scripts/recover-known-finance-records.mjs --input=...` requires explicit user-confirmed JSON data. It refuses conflicting existing targets, restores known baselines and preserves uncertain counts as Review. This was run with the previously authorized October amounts and reported count.

After free access to the old database returns, stop app writers and use:

```
node --env-file=.env.local scripts/import-legacy-postgres.mjs --allow-postgres-read
```

Without that explicit flag, no PostgreSQL connection is attempted. Import reads a consistent read-only SQL snapshot and never deletes or modifies source rows. Old revisions/counts/receipts are archived under legacy kinds. Missing agreements can be restored; newer Notion agreements are never overwritten. Full old check cutoffs can replace only missing/Review records, and saved receipts prevent replay of completed operations. Conflicts stop the import. Review reported counts and the operation cutoff before resuming old queued requests.

This import has not been run while the quota is exhausted. Exact inaccessible history cannot be recovered without its source.

## Validation

The localhost agreement and monthly-summary endpoints returned the restored October targets from Notion. Balance checks returned 200 with recoveryPending=true, without turning the Review count into an estimate. The process environment confirmed PostgreSQL was not configured. Production build and TypeScript passed; Swift request-source parsing passed. Tests cover revision preservation/conflicts, chunking, incomplete histories, cache isolation, household scope, duplicate/unknown outcomes, old queued writes, nested locks and serverless refusal.

A recovered count is exposed as typed `reviewCounts` data, not an API/read error. Home shows its saved amount and Review. The review form prefills that value as a draft and requires Confirm balance; it never activates a count merely by opening the form. Actual-funds warnings remain available for the affected account until confirmation.
