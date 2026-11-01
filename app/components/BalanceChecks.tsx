"use client";
import { SheetBody, SheetHeader } from "./ui/SheetLayout";

import { Banner, bannerTextActionStyle } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { ScaleIcon, ChevronRightIcon, XIcon } from "./ui/icons";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import { accountIconSource } from "../../lib/category-icons";
import type { Account, BudgetScope } from "./app-types";
import type { BalanceCheckView, BalanceCountReview } from "../../lib/balance-checks";
import { accountKey } from "../../lib/balance-checks";
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

export function PendingBalanceChecks({ checks, reviewCounts = [], accounts, scope, error, paused = false, loading, onOpen, onRetry }: {
  checks: BalanceCheckView[]; reviewCounts?: BalanceCountReview[]; accounts: Account[]; scope: BudgetScope; error: string | null; paused?: boolean; loading: boolean;
  onOpen: () => void; onRetry: () => void;
}) {
  const toReview = balanceChecksToReview(checks, reviewCounts, accounts, scope);
  return <section className="balance-check-notices" aria-label="Balance checks" style={{ display: "grid", gap: 12, marginBottom: 20 }}>
    {/* Paused: the server's own reason, no Retry, since retrying can't succeed until it's reconfigured. */}
    {error && paused && <Banner desktopInline tone="neutral" role="status" compact>{error}</Banner>}
    {error && !paused && <Banner desktopInline tone="warning" role="alert" compact action={<button type="button" style={bannerTextActionStyle} onClick={onRetry} disabled={loading}>Retry</button>}>{error}</Banner>}
    {!paused && toReview.length === 0 && <button className="mobile-check-balances" type="button" onClick={onOpen} disabled={loading || accounts.length === 0} style={{ display: "inline-flex", alignItems: "center", justifySelf: "start", gap: 8, minHeight: 44, border: 0, padding: "0 4px", background: "none", color: "var(--text2)", font: "inherit", fontSize: 13, cursor: "pointer" }}>
      <ScaleIcon size={18} /> Check balances
    </button>}
  </section>;
}

export function BalanceCheckAccounts({ open, accounts, onClose, onSelect }: {
  open: boolean; accounts: Account[]; onClose: () => void; onSelect: (account: Account) => void;
}) {
  return <BottomSheet open={open} onClose={onClose} label="Check balances" detent="content" size="standard">
    <SheetBody style={{ padding: 24 }}>
      <SheetHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Check balances</h2>
        <button type="button" className="sheet-close-button" aria-label="Close balance checks" onClick={onClose}><XIcon size={18} /></button>
      </SheetHeader>
      {accounts.map(account => <button key={account.id} type="button" onClick={() => onSelect(account)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "12px 0", border: 0, borderBottom: "1px solid var(--border2)", background: "none", color: "var(--text)", font: "inherit", textAlign: "left", cursor: "pointer" }}>
        <CategoryIcon icon={accountIconSource(account.type)} size={32} /><span style={{ flex: 1 }}>{account.label}</span>{account.balance == null ? "—" : <Money value={account.balance} />}<ChevronRightIcon size={16} />
      </button>)}
    </SheetBody>
  </BottomSheet>;
}
