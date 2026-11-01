# Per-account balance checks — October 28, 2026

Home → Check balances → choose an account → enter the actual count → Save for later.

With Finance Records configured, saved counts and their revisions are shared by the household in Notion, separately from the account cash ledger. The optional PostgreSQL adapter is retained only for legacy configuration. Recording or updating a check never writes a reconciliation or changes account/category balances. Home retains a scoped reminder and actual-funds estimate until the check is explicitly resolved. Existing reconciliation remains an optional, separate action.

Actual-funds estimates start from the recorded count and incorporate later account expenses, income and cash transfers. Category-only transfers have no cash effect. Previously counted transaction IDs and backdated entries before the check day do not spend the count twice. Use Review's missing-transaction action for same-day spending already included in the count; its transaction is recorded as counted. After entering old transactions elsewhere, review/update the physical count if their timing is ambiguous. Estimates cannot account for unlogged real-world spending.

Expense entry, Type it batches, account transfers and bill payments warn when their outgoing amount exceeds estimated actual funds. These are warnings, not new save restrictions: logging something already paid remains possible. Category budget checks remain intact. Failure to read checks is surfaced instead of presenting an empty set as verified. Refresh, focus and periodic visible-page reads pick up the spouse's changes.

Changes use version checks so one device cannot silently overwrite or resolve another device's newer count. Resolution verifies the current live account balance against the actual estimate. Save and resolution bypass the display mirror for validation. Counts use Casablanca calendar days. This release adds no bank connection and no native UI.

Validation: model tests cover cents, old entries, same-day explained entries, bank/cash transfers, future dates and timezone boundaries. PostgreSQL tests cover sharing, household isolation, conflicting updates and stale resolution. API tests cover validation, save-without-ledger-write, explanation and refusing unresolved closure. Browser interactions used an isolated loopback preview which blocked all live ledger mutations: save a count, see Home discrepancy, reload, review and trigger an actual-funds warning. The real localhost GET was checked successfully with zero pending checks; no illustrative count was saved there.

Notion migration on 31 October: the previously reported 494 count is preserved as Review because its original counted-transaction cutoff is unavailable. Review records never supply an actual-funds estimate; a fresh confirmed count replaces them. See [storage and recovery](notion-finance-records.md).
