# Financial display contract

All amounts are read from the existing Notion databases. This contract changes presentation only; it does not change rollups, relations, allocation rules, or stored records.

| Label | Source / formula | Scope | Period | Null handling |
|---|---|---|---|---|
| Account balance | Sum of current non-savings account `balance` values matched to the selected scope | Selected scope | Current snapshot | Missing account balances are excluded; the UI must not replace a failed fetch with zero |
| Available in categories | Sum of category `available` rollups, including carryover, excluding savings categories | Selected category ownership | Current snapshot | Preserve negative values and label them `Overassigned by …`; unknown values display as unavailable |
| Planned this month | Sum of the existing monthly-funds assignments | Selected scope | Explicit selected month | Missing summary is unavailable, not zero after a failed refresh |
| Spent this month | Sum of Expense transactions, including uncategorized expenses | Selected scope | Explicit selected month | Income and transfers are excluded |
| Unassigned in joint account | Signed sum of joint-account `readyToAssign` | Joint only | Current snapshot | Negative values display as `Overassigned by …` |
| Available to contribute | Personal `readyToAssign` less existing positive joint-due amount | Person; joint is the two personal capacities | Current snapshot | Controls may clamp spendable input to zero; informational displays preserve the signed source value |

Activity contains Expense, Income, account Transfer, category Transfer, and uncategorized Expense records. Ownership resolves from category relationships first for expenses, receiving accounts for income, and either endpoint for transfers. Records with no resolvable endpoint are shown only in the explicit `Unassigned` activity view.

Current-month comparisons use day 1 through the current local calendar day and the equivalent available range in the previous month. Completed months compare full months. A zero previous-period total is shown as `No comparison available`.

Expense edit previews restore the booked amount before applying the edited amount. For the same account: `current balance + original expense - edited expense`. When moving accounts, the old account is restored by the original amount and the new account is reduced by the edited amount.
