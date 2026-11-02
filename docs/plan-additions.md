# Adding a forgotten allocation

For an active Joint expense category with an existing contribution agreement, Budget → category → Fund defaults to **Add to plan**. Enter an additional amount; the editor previews each partner's contribution increase using the saved split. One confirmation creates an Additional allocation and raises the agreed targets. Original agreed amounts and recorded contributions remain intact; the existing ledger recalculates the remaining dues. No account transfer is created.

Uncheck **Update agreed contributions** to use the existing funding flow instead. Personal categories, savings deposits, and categories without an agreement keep their existing behavior. Rebalance continues to move existing allocations without revising contributions.

The server validates the live category and holding account, preserves cents, and checks the preview's agreement version before starting. An operation ID persisted in browser storage and the agreement connects the allocation and target revision. Both Postgres and Notion agreement stores retain the recovery markers across subsequent edits.

Notion allocation creation and agreement persistence cannot form one database transaction. If allocation saving succeeds and contribution saving fails, the editor retains the original request and retries the contribution update without creating a second allocation. If allocation creation times out, recovery looks up its unique operation name; it never blindly creates another allocation. An operation whose allocation remains unconfirmed requires later verification rather than another funding attempt. No synthetic financial records are written during verification tests.

Verification: unit tests cover cent rounding, invalid amounts, stale previews, category rejection, repeated submission, changed retry input, unknown create outcomes, partial-save recovery, and marker persistence in both backing stores. Browser automation for the user's internal browser was unavailable in this session; rendered editor verification remains unconfirmed.
