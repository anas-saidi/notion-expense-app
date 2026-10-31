"use client";
import { Banner, bannerActionStyle } from "./ui/Banner";
import { BottomSheet } from "./ui/BottomSheet";
import { ScaleIcon, ChevronRightIcon, XIcon } from "./ui/icons";
import { Money } from "./Money";
import { CategoryIcon } from "./ui/CategoryIcon";
import type { Account, BudgetScope } from "./app-types";
import type { BalanceCheckView } from "../../lib/balance-checks";
import { accountKey, money } from "../../lib/balance-checks";
import { fmt, scopeFromAccountLabel } from "./app-utils";

export function PendingBalanceChecks({ checks, accounts, scope, error, loading, onReview, onOpen, onRetry }: {
  checks: BalanceCheckView[]; accounts: Account[]; scope: BudgetScope; error: string | null; loading: boolean;
  onReview: (account: Account) => void; onOpen: () => void; onRetry: () => void;
}) {
  const pending = checks.flatMap(check => {
    const account = accounts.find(account => accountKey(account.id) === check.accountId);
    return account && (scopeFromAccountLabel(account.label) === scope || !scopeFromAccountLabel(account.label)) ? [{ check, account }] : [];
  });
  return <section className="balance-check-notices" aria-label="Balance checks" style={{ display: "grid", gap: 12, marginBottom: 20 }}>
    {pending.map(({ check, account }) => {
      const difference = account.balance == null ? null : money(check.estimatedActual - account.balance);
      const matches = difference !== null && Math.abs(difference) < 0.01;
      return <Banner key={check.accountId} tone={matches ? "info" : "warning"} icon={<ScaleIcon size={18} />}
        title={matches || difference == null ? account.label : `${account.label} discrepancy`}
        action={<button type="button" style={bannerActionStyle} onClick={() => onReview(account)}>Review</button>}>
        {difference == null ? "Refresh to compare" : matches ? "Balances match" : `${fmt(Math.abs(difference))} ${difference < 0 ? "short" : "extra"}`}
      </Banner>;
    })}
    {error && <Banner desktopInline tone="warning" role="alert" compact action={<button type="button" style={bannerActionStyle} onClick={onRetry} disabled={loading}>Retry</button>}>Balance checks unavailable. Refresh before relying on actual-funds estimates.</Banner>}
    <button className="mobile-check-balances" type="button" onClick={onOpen} disabled={loading || accounts.length === 0} style={{ display: "inline-flex", alignItems: "center", justifySelf: "start", gap: 8, minHeight: 44, border: 0, padding: "0 4px", background: "none", color: "var(--text2)", font: "inherit", fontSize: 13, cursor: "pointer" }}>
      <ScaleIcon size={18} /> Check balances
    </button>
  </section>;
}

export function BalanceCheckAccounts({ open, accounts, onClose, onSelect }: {
  open: boolean; accounts: Account[]; onClose: () => void; onSelect: (account: Account) => void;
}) {
  return <BottomSheet open={open} onClose={onClose} label="Check balances" detent="content" maxWidth="500px">
    <div style={{ padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Check balances</h2>
        <button type="button" className="sheet-close-button" aria-label="Close balance checks" onClick={onClose}><XIcon size={18} /></button>
      </header>
      {accounts.map(account => <button key={account.id} type="button" onClick={() => onSelect(account)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 60, padding: "12px 0", border: 0, borderBottom: "1px solid var(--border2)", background: "none", color: "var(--text)", font: "inherit", textAlign: "left", cursor: "pointer" }}>
        <CategoryIcon icon={account.icon} size={32} /><span style={{ flex: 1 }}>{account.label}</span>{account.balance == null ? "—" : <Money value={account.balance} />}<ChevronRightIcon size={16} />
      </button>)}
    </div>
  </BottomSheet>;
}
