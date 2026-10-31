# Monthly contribution agreements and advances

## Contract

A confirmed agreement stores original and current partner targets, shares, month, confirmation time and revision version. Category allocations and account reconciliations never rewrite it. The first shared-plan save confirms its displayed proposal; personal-only planning does not create a zero shared agreement. Existing plans can explicitly set contributions; changing a confirmed agreement preserves its original values.

October 2026 was initialized with the user-authorized original targets: Anas 11,638.25 MAD and Salma 6,266.75 MAD. These values are household data, not application defaults. No cash balance or financial transaction was changed during setup.

Contribution credit includes ordinary net personal-to-Joined transfers and personal-paid shared non-savings expenses. Dedicated separate savings transfers are excluded. Personal borrowing from Joined is repaid before inbound money earns contribution credit, using the existing all-history borrowing rules.

Above-original is historical comparison. An advance is max(0, contributed minus current agreed target). Explicit agreement revisions can change the advance without erasing the original comparison. Joined owes the remaining advance less recorded repayments. Months with no agreement never generate inferred advances.

## Persistence

Agreements use the existing DATABASE_URL connection and the same household scope as balance checks. finance_contribution_agreements contains one current record per household/month; finance_contribution_agreement_history appends accepted revisions. Both tables are durable business data and must be included in database backups. They are independent of disposable mirror generations. Concurrent edits use a version comparison and atomic conditional upsert. Missing database configuration makes confirmation unavailable; a configured database read failure makes the monthly financial read fail rather than displaying zero obligations.

Repayments are ordinary Notion Transfer records with a Contribution repayment rich-text property containing a unique request identifier. The property is created only when the first repayment is recorded. A household advisory lock serializes repayment validations; a repeated request finds and returns the existing transfer. Page creation is not automatically retried. The UI never executes a bank transfer.

Each marked repayment is applied to that person's oldest outstanding month first, limited to agreements no later than its transaction month. It does not reduce the current month's contribution. Removing/restoring a repayment recalculates debt. Correcting a transaction or agreement can expose unapplied repayment amounts; the UI warns rather than inventing negative debts.

## Reservations and planning

Outstanding advances are deducted once from Joined's signed unassigned capacity. Negative capacity represents commitments that new funding must cover before new category allocations. Both the web planner and native planning resource use this reservation; server-side monthly-plan and additional-allocation checks protect it. Existing cash, savings reserves and category commitments remain distinct. Recording repayment reduces cash and the reservation by the same amount, leaving net unassigned capacity unchanged. Expected repayment receipts are not added to personal planning capacity before they occur.

The contribution sheet offers month selection, original/agreed amounts, actual contributions, historical excess and current outstanding amounts. Historical review uses the current repayment ledger so it does not show already-repaid October advances as owed today. The recorded-cash shortfall is explicitly before other category commitments. Reconcile the actual Joined cash separately.

## Validation

Unit tests cover the October calculation, balance corrections, Joined-paid and personal-paid expenses, transaction edits/deletion, savings exclusions, personal borrowing, partial repayment, month carryover, revised agreements, invalid repayments, retry identifiers and signed planning capacity. PostgreSQL-compatible store tests verify durability, household isolation, immutable originals and stale-write rejection. Live reads reproduced the October 820.75 / 314.25 MAD advances. No test repayments were written to the live ledger.
