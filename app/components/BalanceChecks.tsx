"use client";

import { Banner, bannerTextActionStyle } from "./ui/Banner";
import type { Account, BudgetScope } from "./app-types";
import { accountKey } from "../../lib/balance-checks";
import type { BalanceCheckView, BalanceCountReview } from "../../lib/balance-checks";
import { scopeFromAccountLabel } from "./app-utils";

/** Accounts in this scope with a check or a saved count waiting for review. Home shows nothing else while any exist. */
export function balanceChecksToReview(checks: BalanceCheckView[], reviewCounts: BalanceCountReview[], accounts: Account[], scope: BudgetScope) {
  const inScope = (account: Account) => !scopeFromAccountLabel(account.label) || scopeFromAccountLabel(account.label) === scope;
  const find = (id: string) => accounts.find(account => accountKey(account.id) === id && inScope(account));
  return [
    ...checks.flatMap(check => { const account = find(check.accountId); return account ? [{ key: check.accountId, account, counted: check.estimatedActual }] : []; }),
    ...reviewCounts.flatMap(count => { const account = find(count.accountId); return account ? [{ key: `review-${count.accountId}`, account, counted: count.actualBalance }] : []; }),
  ];
}

/** Home shows balance-check failures here; discrepancies live in its tappable summary. */
export function PendingBalanceChecks({ error, paused = false, loading, onRetry }: {
  error: string | null; paused?: boolean; loading: boolean; onRetry: () => void;
}) {
  if (!error) return null;
  return <section className="balance-check-notices" aria-label="Balance checks" style={{ display: "grid", gap: 12, marginBottom: 20 }}>
    {paused
      ? <Banner desktopInline tone="neutral" role="status" compact>{error}</Banner>
      : <Banner desktopInline tone="warning" role="alert" compact action={<button type="button" style={bannerTextActionStyle} onClick={onRetry} disabled={loading}>Retry</button>}>{error}</Banner>}
  </section>;
}
