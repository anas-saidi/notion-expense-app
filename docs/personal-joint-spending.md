# Personal spending paid by Joint

An expense in an Anas or Salma personal budget, paid from the Joined Account, is owed in full by that budget's owner. It still reduces that personal budget and Joint's cash normally. The debt is included in the partner's amount due and reduces their available planning capacity; it is never split using household contribution percentages.

Ordinary transfers from a personal account to Joint repay that person's earlier borrowing first. Only the remainder counts as a household contribution. Transfers before borrowing do not prepay future debts. Savings deposits and purchases from funded savings are separate and do not create or repay these debts.

The app rebuilds debt from all transaction history up to the selected month's end, ordered by transaction date, creation time, and ID. This includes existing historical expenses. Edits, deletion/restoration, and repayment deletion recalculate the result. Archived and snoozed personal budgets still count. No separate Notion debt records or schema changes are needed.

The PWA and native snapshot/planning APIs use the same calculation. Older native cached snapshots remain readable. Refresh after deploying to obtain the new totals.

Validation: ledger unit tests cover both partners, cents, monthly carry-over, partial/full repayment, excess transfers, edits/deletion, archived budgets, savings exclusions and same-day ordering. The monthly API test covers pagination and exclusion of earlier spending from monthly totals. A browser UI journey uses an isolated API fixture: spending 19.95 MAD from a personal budget using Joint increases debt from 123.45 to 143.40 MAD. Desktop and 375px mobile layouts were inspected. No live financial records were changed for testing.

Presentation: personal borrowing is included only in the existing due amount in both apps, without a separate debt notice or entry-form explanation. Native build 4 follows this presentation. Its contract tests cover decimal amounts and older snapshots. The native Home UI journey passed in the iOS simulator, and the Release IPA was built successfully. Production deployment `dpl_Gngc4fc3f2KCGxkxTVxVYswpQPwu` was promoted and verified with an authenticated HTTP 200 snapshot containing both debt fields.
