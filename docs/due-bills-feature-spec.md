# Due bills and recurring expenses

Status: Implemented initial recurring flow on 3 October 2026; validation and limitations below. Notion properties were created manually by the user.
Date: 28 September 2026
Prototype: `/due-lab` (development only; predates this revision, see §12)

## 1. Purpose

Show upcoming obligations alongside the money available to cover them. A bill earmarks part of its category's available money without becoming actual spending until payment is recorded.

Keep bills and payments in the existing Transactions database. Do not introduce a Bills database or a separate paid-bill transaction type.

### Core idea: occurrences are derived, not stored

A bill is **one schedule row** in Transactions. Its occurrences (this month's rent, next month's rent) are **calculated on read** from that schedule. A row is written only when something actually happens to an occurrence:

- **Paid** → a new ordinary `Expense` row, linked to the schedule and its period.
- **Skipped / edited** → an entry in the schedule's metadata.

Nothing else is stored. There is no generation step, no scheduler, and no unpaid occurrence rows. An unpaid occurrence is simply a scheduled period with no payment and no skip.

Consequences:

- Bills cannot silently fail to appear because someone forgot to generate them.
- Retries and simultaneous devices cannot create duplicate unpaid bills; there is nothing to duplicate.
- Overdue bills persist across month rollover automatically, with no backfill.
- Stopping a series is a single field change.
- Undoing a payment is archiving its Expense row; the occurrence reverts to due by derivation.
- Expected amounts come from the schedule, never from a payment, so paying 550 against 600 cannot change future bills.

### Confirmed constraints

- This feature belongs to the existing shared finance app and its Joint / Anas / Salma scope.
- Unpaid bills are potential spending. Category availability and account balances remain intact until payment.
- Paid bills are ordinary `Expense` transactions and use the existing spending calculations.
- Every scheduled period is a distinct occurrence; an unpaid earlier occurrence is never replaced by a later one.
- Additional properties in Transactions are permitted for consideration; the final schema has not been approved.

### Proposed first release

- One-off bills, monthly recurrence, and yearly recurrence.
- Due, paid, and skipped views; overdue is a derived condition.
- Create, edit (this occurrence / future occurrences), pay, undo payment, skip, restore, and stop repeating.
- Category reservation context and warnings when ordinary spending uses earmarked money.

### Outside the first release

Partial payments, installments, custom recurrence intervals, linking an already-recorded expense to a bill, bank reconciliation, automatic payment execution, recurring income, push reminders, currency conversion, and savings contributions. Recording a payment does not initiate a bank payment.

## 2. Financial contract

For category C and reservation cutoff D:

- **Available A:** the existing current category Available value from Notion.
- **Earmarked R:** sum of expected amounts of derived occurrences in C that are unpaid, not skipped, and due on or before D.
- **Free after bills F:** A − R.

The proposed default cutoff is the end of the current month (see open decisions for a rolling window). Overdue occurrences are always included. Looking ahead to another month moves the cutoff, not the source of Available: it remains a current snapshot, not a forecast of future income or allocations.

Example:

| Action | Available | Earmarked | Free after bills |
|---|---:|---:|---:|
| Category has 2,000; bill for 600 added | 2,000 | 600 | 1,400 |
| Bill paid for exactly 600 | 1,400 | 0 | 1,400 |
| Alternatively, bill paid for 550 | 1,450 | 0 | 1,450 |
| Alternatively, occurrence skipped | 2,000 | 0 | 2,000 |

Amounts are MAD. Preserve the existing formatting and shared Money component.

### Invariants

1. Creating or editing a schedule never changes actual spending, category Available, account balance, assignment totals, or contribution totals.
2. Paying creates exactly one `Expense` row linked to the schedule and period. The schedule row itself never becomes an Expense.
3. Reservations are derived, never a stored debit against the category.
4. Negative free-after-bills means a funding shortfall. Show the signed value and explain the amount to fund; do not hide or clamp it in informational displays.
5. Available comes from the live category source. Do not subtract payments from a balance already net of them.
6. Unknown balances or failed schedule/payment fetches are unavailable/stale states, not zero. A failed payments fetch must not make paid bills look unpaid (or vice versa); show the whole Due view as stale instead.
7. Ordinary spending still uses the existing actual-availability gate. If it fits A but leaves less than R, warn and allow explicit continuation. Earmarking is never a hard prohibition.
8. Paying a bill uses the existing actual-availability gate. Exclude that occurrence's own reservation when explaining the impact on other unpaid bills.
9. An occurrence's expected amount, category, and nominal due date come only from its schedule (base values, revisions, overrides), never from a payment.

Reference: `docs/financial-display-contract.md`. The existing contract remains authoritative for all actual financial values; these derived values supplement it.

## 3. Data model

### Schedule row (one per bill)

| Property | Notion type | Meaning |
|---|---|---|
| Name | Title (existing) | Bill name |
| Type | Select (existing) | New option: `Due` |
| Amount | Number (existing) | Current expected amount |
| Category | Relation (existing) | Current category charged |
| Account | Relation (existing) | **Left empty.** Intended paying account lives in Bill metadata |
| Date | Date (existing) | **Left empty.** Keeps schedules out of every date-ranged query |
| Due date | Date (new) | First occurrence's due date; also the anchor (day, and month for yearly) |
| Repeat | Select (new) | `None`, `Monthly`, `Yearly` |
| Bill metadata | Rich text (new) | App-managed JSON, see below |

The schedule's Notion page ID is the series identity. No separate Series ID is needed.

Name, Amount, and Category hold the **current** values. Notion edits to them are supported and apply to every unpaid occurrence not covered by an override or an older revision (see Bill metadata).

### Payment row (one per paid occurrence)

An ordinary `Expense` row with two additional properties:

| Property | Notion type | Meaning |
|---|---|---|
| Bill | Relation → Transactions (self-relation) | The schedule row this payment settles |
| Bill period | Rich text | Nominal period `YYYY-MM` of the settled occurrence |

Amount, Account, Category, and Date are the actual payment values. Existing expense logic, charts, and totals see a normal Expense. Existing Expense rows need no migration; their Bill relation is empty.

### Bill metadata

Versioned JSON on the schedule row. The app validates it on read and write; direct editing in Notion is unsupported.

```json
{
  "v": 1,
  "end": "2026-12",
  "account": "<account page id>",
  "skipped": ["2026-10"],
  "overrides": { "2026-11": { "amount": 480, "due": "2026-11-05" } },
  "revisions": [{ "until": "2026-08", "amount": 550, "categoryId": "<page id>" }]
}
```

- `end` — last period that produces an occurrence (stop repeating). Absent = open-ended.
- `account` — default paying account suggested at payment.
- `skipped` — periods skipped; they reserve nothing and are never due.
- `overrides` — "this occurrence only" edits of amount, category, or due date. The period key stays the nominal one.
- `revisions` — previous values for periods up to `until`, recorded when "future occurrences" edits change the current properties. This keeps overdue earlier occurrences at their original expectation.

Malformed metadata marks that bill as unavailable in the UI; it is never treated as empty.

Size: a Notion rich-text item holds 2,000 characters and a property holds up to 100 items. A monthly bill adds at most a few entries per year, so this is ample. The storage helper must split and join items transparently.

**Alternative considered:** separate properties per concern (Skipped periods, End period, …). Rejected for the first release: overrides and revisions don't map cleanly onto Notion property types, and one validated blob is easier to evolve. Revisit if Notion-side visibility becomes important.

### Scope

Scope resolves through the Category relation's existing ownership. Do not persist a scope on the schedule or payment.

## 4. Derivation

### Periods

Every occurrence is identified by `(schedule page ID, period)`, where period is `YYYY-MM`.

- `None`: one period, the month of Due date.
- `Monthly`: every month from the Due date month through `end` (or the view horizon).
- `Yearly`: the Due date's month in each year from its year through `end`.

### Nominal due date

The anchor day from Due date, clamped to the last day of the period's month: January 31 → February 28 (29 in leap years) → March 31. A February 29 yearly anchor clamps to February 28 in non-leap years. An override `due` replaces the displayed date without changing the period.

All dates are calendar dates in `Africa/Casablanca`, not UTC timestamps. Payment date never affects future due dates.

### Occurrence state

For each period, in order of precedence:

1. A linked payment exists → **Paid**.
2. The period is in `skipped` → **Skipped**.
3. Due date < today → **Overdue**.
4. Otherwise → **Due**.

Expected values for a period: override → the first revision whose `until` ≥ period → the schedule's current properties.

### Inputs and cost

Deriving the Due view needs two queries:

- Schedules: `Type = Due` (dozens of rows).
- Payments: `Bill` is not empty (roughly bills × 12 per year; paginate).

Horizon: derive from each schedule's start through the view's cutoff. Unpaid occurrences are never discarded, so an old unpaid occurrence stays overdue until it is paid or skipped. If the payment query grows too large, add a `settled through` hint to metadata later; it isn't needed for the first release.

Derivation is a pure function `deriveOccurrences(schedules, payments, today, horizon)` in shared code, used by both the UI and the server funding checks, with unit tests.

### Anomalies

- **Two payments for one occurrence** (e.g. simultaneous devices): show the occurrence as Paid with a visible "recorded twice" warning and a link to both rows. Never silently hide one.
- **Payment linked to an archived schedule:** remains an ordinary Expense; the bill no longer appears in Due.
- **Payment for a period the schedule no longer produces** (e.g. after `end` moved earlier): keep it as an ordinary Expense and show it in Paid history.

## 5. Lifecycle

| Action | Stored outcome | Financial outcome |
|---|---|---|
| Add bill | Create schedule row | Occurrences within cutoff reserve their expected amount |
| Pay occurrence | Create Expense with Bill + Bill period | Release reservation; record actual spending |
| Undo payment | Archive that Expense row | Remove spending; occurrence reverts to Due/Overdue |
| Skip occurrence | Add period to `skipped` | Release reservation; no spending |
| Restore skipped | Remove period from `skipped` | Reservation returns if within cutoff |
| Edit this occurrence | Set `overrides[period]` | Recalculate that reservation |
| Edit future occurrences | Push a revision for past periods; update current properties | Earlier unpaid occurrences keep their expectation; paid history untouched |
| Stop repeating | Set `end` | No later occurrences; earlier unpaid ones remain payable |
| Delete bill | Archive schedule row | All unpaid occurrences disappear; payments remain as Expenses |

"Stop repeating" and "Delete bill" are distinct actions. Delete must show how many unpaid occurrences disappear. Undo payment must show that it removes actual spending.

Canceling a one-off bill is skipping its single occurrence (recoverable), not deleting it.

## 6. Writes and concurrency

Two people on a few devices. The design targets correctness under that load, not general distributed locking.

**Paying** goes through a server route (e.g. `POST /api/bills/pay`) that:

1. Re-derives the occurrence from fresh Notion reads and rejects it if it is already Paid or Skipped.
2. Runs the existing server-side expense funding gate.
3. Creates the Expense row.
4. On timeout or an ambiguous error, queries for a payment with that Bill + period before reporting failure or retrying. It never blindly re-creates.

The remaining race (two devices paying the same occurrence within the same second) is surfaced by the "recorded twice" anomaly rather than prevented.

**Metadata edits** (skip, restore, overrides, revisions, end) are read-modify-write on one row:

1. Read the row and remember `last_edited_time`.
2. Apply the change to the parsed metadata.
3. Immediately before writing, re-read; if `last_edited_time` changed, re-apply the change to the fresh metadata and retry once.
4. Write. If the retry also conflicts, fail with a specific "someone just changed this bill" message and keep the user's input.

Each change is expressed as an operation (`skip 2026-10`), not a whole-document replace, so re-applying it is safe.

## 7. User flows

### Add bill

Fields: name, positive expected amount, category (restricted to the current scope), first due date, repeat, and optional default paying account. Warn if the new reservation produces a funding shortfall, but allow saving: an obligation can exist before it is funded.

Use a contextual bottom sheet. Saving returns to the due list and announces success. Keep input on validation or network failure.

### Pay bill

Open the occurrence and confirm actual amount (prefilled with expected), account (prefilled from metadata), and payment date (today). Show the reservation being released and the resulting category position. Validate via the existing funding gate.

Disable repeat submission while saving. On success refresh transactions, categories, accounts, and relevant monthly summaries as one UI transition, so stale balances and a released reservation never briefly suggest extra money.

The first release warns users not to record the same payment separately as an ordinary expense; linking an existing expense to a bill is a later flow.

### Skip and stop

"Skip this occurrence" releases only that occurrence and offers restore. "Stop repeating" explains that already-due bills stay payable. Keep the two apart in both wording and placement.

### Edit

For recurring bills, choose "This occurrence" or "Future occurrences". Paid occurrences are edited as ordinary expenses. A future edit lists any currently unpaid earlier occurrences and states that they keep their original amount.

## 8. Interface specification

Placement is still proposed: a concise Due section on Home leading to a fuller scoped view. Do not add a primary navigation destination without reviewing the existing Home / Budget / Reflect structure. `/due-lab` is a playground, not an approved navigation design.

- Inherit global Joint / Anas / Salma scope.
- Show a month selector and state the reservation period explicitly.
- Show Available / Earmarked / Free after bills by category for the current month. For future months, list the upcoming occurrences but don't show Free after bills against today's Available. It reads as a shortfall before that month's income and allocations exist.
- List overdue first, then remaining unpaid occurrences by due date.
- Due / Paid / Skipped filters represent occurrence state. Paid groups by actual payment month; Skipped by period.
- Each flat row shows bill name, category, recurrence when applicable, due/payment date, and amount.
- Show shortfall guidance at the relevant category, not as a blanket "no money available" state.
- Use the shared Money, bottom-sheet, row, token, and haptic conventions from `design.md`.
- Keep passive dates and recurrence labels as text, not chips or badges.
- Minimum 44-point targets; keyboard access, visible focus, accessible field labels, tabular numbers, sufficient contrast, safe areas, and Reduce Motion support.

States: initial loading, no bills, no results for a filter, overdue, insufficient actual funding, potential funding shortfall, saving, stale data, failed refresh, failed save, edit conflict, malformed bill, and payment recorded twice. Errors keep user input and offer a specific retry.

## 9. Integration and calculation audit

Do not change the Notion schema until this audit is reviewed.

Schedule rows are `Type = Due` rows with an Amount and a Category relation but no Date and no Account. Audit every path that could count them as money movement:

- **Category Available formulas/rollups** — the highest risk. A rollup summing Amount over all related transactions would treat every schedule as spending. Confirm they filter by Type, or change them to before any schedule exists.
- Account balance formulas/rollups (Account is empty on schedules, but verify).
- Monthly spending, category activity, Reflect totals, recent activity, charts, and transaction counts.
- `GET /api/transactions` without `start`/`end` (no Date filter): schedules would appear in recent activity unless excluded by Type.
- Income, transfers, reconciliation, household contributions, and assignment calculations.
- TypeScript transaction unions, API validation, search/reuse suggestions, caches, and edit/delete flows. Editing a payment Expense must keep Bill and Bill period.

If the audit finds Category rollups that cannot be made Type-aware, the fallback is to leave Category empty on the schedule row and store it in metadata as well. That costs Notion-side readability but removes the rollup risk.

Existing `Type = Expense` sums remain unchanged; bill payments are Expenses by design.

Do not automatically convert existing Pending items. Any import is an explicit reviewed selection; the Pending database is untouched by this release.

## 10. Acceptance criteria

1. Adding a 600 bill to a category with 2,000 available shows 2,000 available, 600 earmarked, 1,400 free. No Expense row exists and actual spending and account balances are unchanged.
2. Paying it for 600 creates one Expense linked to the schedule and period and shows 1,400 / 0 / 1,400 after refresh. The schedule row is unchanged.
3. Paying it for 550 shows 1,450 available, and the next occurrence still expects 600.
4. A bill can be created when its category lacks funds. Payment still requires actual funding.
5. An ordinary expense that uses earmarked money gets an advisory warning but is allowed when actual availability permits.
6. An unpaid September occurrence is still Overdue and reserved in November, with no user action.
7. A monthly bill shows a correct occurrence for every month from its start without any generation step, on every device.
8. January 31 → February 28/29 → March 31; February 29 yearly → February 28 in non-leap years.
9. Skipping releases only that occurrence and doesn't affect the next one. Restore brings it back.
10. Stopping prevents later occurrences and leaves earlier unpaid ones payable.
11. Archiving a payment returns its occurrence to Due/Overdue.
12. Editing future occurrences leaves unpaid earlier occurrences at their original amount; editing one occurrence changes only that period.
13. Retrying a timed-out payment never produces two Expenses; if two exist anyway, the UI flags it.
14. Concurrent skips from two devices on the same bill both take effect or one fails visibly. Neither is silently lost.
15. Joint / Anas / Salma data stays scoped by category ownership.
16. Failed reads never present missing values as zero; failed writes keep input.
17. Existing Expense, Income, Transfer, planning, and contribution calculations are unchanged, verified against representative Notion records.
18. Mobile and desktop flows are inspected in the running app, including keyboard, sheet dismissal, narrow screens, and payment/error states.

## 11. Delivery plan and review gates

1. **Prototype update:** move `/due-lab` to the derived model (schedules + payments + metadata in local state, `deriveOccurrences` as the only source of occurrences) and review hierarchy, payment flow, and cutoff.
2. **Read-only audit:** §9 against live Notion formulas and app queries.
3. **Schema review:** approve the exact property and option additions in §3 before writing them.
4. **Core:** `deriveOccurrences` + tests, schedule CRUD, pay/undo route, compatible queries and calculations.
5. **Occurrence management:** skip/restore, overrides, revisions, stop, conflict handling.
6. **Verification:** acceptance tests, live-data-safe integration checks, and mobile/desktop visual review.
7. **Optional:** reminders, and linking existing expenses to bills.

### Open decisions

- Reservation cutoff: current month-end, or a rolling window (e.g. next 30 days) so a bill due on the 1st is reserved at month-end.
- Initial entry point: Home section versus a dedicated destination.
- Whether to support Notion-side edits to Due date (it moves the anchor for the whole series), or treat it as app-only.
- Confirm the §9 fallback if Category rollups can't be made Type-aware.

## 12. Current prototype and limits

Files: `app/due-lab/page.tsx`, `DueLab.tsx`, `model.ts`, `model.test.ts`, and `due.css`. Dev-only, sample data, fixed demo date of 28 September 2026, no Notion writes, resets on reload.

The prototype **predates this revision**: it materializes occurrences through a "Generate this month's bills" button. Behaviour that differs from this spec and should not be carried forward:

- Paying overwrites the occurrence's amount, and generation copies it forward, so a 250 payment on a 300 bill makes next month expect 250 (violates invariant 9).
- Undo payment keeps the paid amount as the expected amount.
- Stop repeating rewrites `repeat` on every occurrence, including paid history.
- Generating a later month skips intervening months.
- Scope is stored on each bill instead of resolved through category ownership, and category choices aren't restricted by scope.
- The paying account selector is a placeholder.

Delivery step 1 replaces these mechanics.

## 13. Implementation and read-only Notion audit — 3 October 2026

- Live Transactions schema verified through the app's configured integration: `Type` includes `Due`; `Due Date` is Date; `Repeat` is Select; `Bill` is a self-relation; `Bill period` and `Bill metadata` are rich text. Due date matching is case-insensitive. Repeat options were empty at inspection; saving a select value through Notion creates its named option.
- Category `Available` and `Available ( this month )` filter transactions by `Type = Expense`. Account `Current Balance` filters Income and Expense separately. These calculations need no changes for schedules.
- Category `Spent` and `Last Month ( Spent )` use date filters without Type filters. Schedule writes explicitly leave payment Date empty; reads reject schedules with payment Date or Account set. Keep these fields empty when editing schedules directly in Notion. Type-aware secondary formulas would further protect against manual misuse; they were not altered here.
- `/api/transactions` and transaction-inclusive monthly summaries explicitly exclude `Due`. Category activity already selects Expenses and Transfers. Existing Expense edits preserve the Bill relation and Bill period because they patch only ordinary expense properties.
- `lib/bills.ts` is the shared pure recurrence model; `lib/notion-bills.ts` handles schema checks, paginated reads, schedule operations, payment writes, ambiguous-create recovery, and metadata conflict checks. `/api/bills` exposes these actions behind the existing app authentication middleware.
- Home supports add, monthly/yearly recurrence, current-month earmarking, scoped month/state views, record payment, undo, skip/restore, edit this occurrence or future expectations, stop, and archive schedule. Paid lists use actual payment month. Duplicate payments remain visible with links to their Expense rows.
- The ordinary expense form warns before using earmarked money; Type it and Shortcuts retain their existing actual-budget validation but do not yet have the bill advisory. Reservations are advisory and never a stored debit.
- Recurrence anchors and repeat intervals are immutable after creation. Change the due date for a single occurrence, or stop and create another schedule to change the repeating anchor. This deliberately avoids silently removing old periods.
- Future edits support amount, category, name, and suggested account. Names are schedule-level; older occurrences display the current bill name. Metadata uses `categoryId` consistently for overrides/revisions.
- Schedule actions serialize within one server process. Across server instances Notion has no conditional write guarantee: optimistic re-read detects many conflicts but cannot eliminate the final race. Duplicate payments are surfaced.
- Validation: pure recurrence and mocked Notion tests cover month-end anchors, leap years, overdue carryover, skips/stops, revisions/overrides, differing actual payments, duplicates/orphans, malformed metadata, budget rejection, rich-text splitting, and ambiguous payment creates. All 346 tests and TypeScript passed; production build passed with existing jose Edge warnings and Browserslist data warning. Live GET returned an empty bill dataset successfully. No live schedule or payment writes were made during verification; actual end-to-end writes remain unverified.
- Desktop and iPhone-width empty/create states inspected in Brave. Non-empty and payment states are covered by model/service tests but have not been visually inspected against live bills.
