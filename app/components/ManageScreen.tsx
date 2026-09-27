"use client";

import { useMemo, type CSSProperties } from "react";
import type { Account, BudgetScope } from "./app-types";
import { assignableOf, scopeFromAccountLabel } from "./app-utils";
import { Money } from "./Money";
import { BottomSheet } from "./ui/BottomSheet";
import { XIcon } from "./ui/icons";

type ManageScreenProps = {
  accounts: Account[];
  budgetScope: BudgetScope;
  onClose: () => void;
  onOpenDetails: (account: Account) => void;
};

export function ManageScreen({ accounts, budgetScope, onClose, onOpenDetails }: ManageScreenProps) {
  const scopedAccounts = useMemo(
    () => accounts.filter((account) => {
      const scope = scopeFromAccountLabel(account.label);
      return scope === null || scope === budgetScope;
    }),
    [accounts, budgetScope],
  );
  const totals = useMemo(() => ({
    balance: scopedAccounts.reduce((sum, account) => sum + (account.balance ?? 0), 0),
    ready: scopedAccounts.reduce((sum, account) => sum + (assignableOf(account) ?? 0), 0),
  }), [scopedAccounts]);

  return (
    <BottomSheet
      open
      onClose={onClose}
      label="Accounts"
      maxWidth="480px"
      panelStyle={sheetStyle}
      contentStyle={sheetContentStyle}
    >
    <main className="manage-screen" style={screenStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Accounts</h1>
        <button className="sheet-close-button" type="button" onClick={onClose} aria-label="Close accounts" style={closeStyle}>
          <XIcon size={18} />
        </button>
      </header>

      <section aria-label="Account totals" style={heroStyle}>
        <span style={heroLabelStyle}>Total balance</span>
        <strong style={heroAmountStyle}>
          <Money value={totals.balance} currency animated animateOnMount />
        </strong>
        <span style={readyMetricStyle(totals.ready < 0)}>
          <span>Unassigned</span>
          <strong><Money value={totals.ready} /></strong>
        </span>
      </section>

      <section aria-labelledby="account-list-heading" style={accountsSectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 id="account-list-heading" style={sectionTitleStyle}>Your accounts</h2>
          <span style={accountCountStyle}>{scopedAccounts.length}</span>
        </div>

        {scopedAccounts.length > 0 ? (
          // Same anatomy as transaction rows elsewhere: flat, emoji, name over type,
          // the figure on the right with its secondary line beneath.
          <div className="manage-account-list" style={listStyle}>
            {scopedAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onOpenDetails(account)}
                aria-label={`View ${account.label} details`}
                className="tx-row transaction-row manage-account-row"
                style={accountRowStyle}
              >
                <span style={accountIconStyle} aria-hidden="true">{account.icon}</span>
                <span style={accountCopyStyle}>
                  <span style={rowTitleStyle}>{account.label}</span>
                  <span style={rowMetaStyle}>{account.type ?? "Account"}</span>
                </span>
                <span style={amountStackStyle}>
                  <span style={balanceStyle}><Money value={account.balance ?? 0} /></span>
                  <span style={readyStyle((assignableOf(account) ?? 0) < 0)}>
                    Ready <Money value={assignableOf(account) ?? 0} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>No accounts match this profile.</div>
        )}
      </section>
    </main>
    </BottomSheet>
  );
}

const screenStyle: CSSProperties = {
  width: "100%",
  margin: "0 auto",
  padding: "4px 16px calc(env(safe-area-inset-bottom, 0px) + 28px)",
  display: "grid",
  alignContent: "start",
  gap: 32,
};

const sheetStyle: CSSProperties = { borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0", background: "var(--bg)" };
const sheetContentStyle: CSSProperties = { overflowX: "hidden" };

const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const titleStyle: CSSProperties = { margin: 0, fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.1, fontWeight: 750, letterSpacing: "-0.025em", color: "var(--text)" };
const closeStyle: CSSProperties = { width: 44, height: 44, border: "none", borderRadius: "50%", background: "var(--surface2)", color: "var(--text2)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const heroStyle: CSSProperties = { display: "grid", justifyItems: "center", gap: 10, padding: "16px 0 8px", textAlign: "center" };
const heroLabelStyle: CSSProperties = { fontSize: 12, lineHeight: 1, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--muted)" };
const heroAmountStyle: CSSProperties = { display: "inline-flex", justifyContent: "center", fontFamily: "var(--font-body)", fontSize: "clamp(44px, 13vw, 64px)", lineHeight: 0.96, fontWeight: 500, letterSpacing: "-0.035em", color: "var(--text)", whiteSpace: "nowrap" };

const readyMetricStyle = (negative: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "baseline", gap: 8, minHeight: 32, marginTop: 4, padding: "7px 10px", borderRadius: 9,
  background: negative ? "color-mix(in srgb, var(--danger) 10%, var(--surface))" : "color-mix(in srgb, var(--success) 10%, var(--surface))",
  color: negative ? "var(--danger)" : "var(--success)", fontSize: 12, fontWeight: 650,
});

const accountsSectionStyle: CSSProperties = { display: "grid", gap: 12 };
const sectionHeaderStyle: CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.2, fontWeight: 750, color: "var(--text)" };
const accountCountStyle: CSSProperties = { minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, background: "var(--surface2)", color: "var(--text2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 };
const listStyle: CSSProperties = { display: "grid" };

// Mirrors ui/TransactionRow so account rows read like every other list in the app.
const accountRowStyle: CSSProperties = { width: "100%", minHeight: 64, padding: "10px 2px", border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" };
const accountIconStyle: CSSProperties = { width: 24, height: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, lineHeight: 1 };
const accountCopyStyle: CSSProperties = { flex: 1, minWidth: 0, display: "grid", gap: 3 };
const rowTitleStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, lineHeight: 1.2, fontWeight: 500, color: "var(--text2)" };
const rowMetaStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, lineHeight: 1.2, color: "var(--muted)" };
const amountStackStyle: CSSProperties = { display: "grid", justifyItems: "end", gap: 6, flexShrink: 0, whiteSpace: "nowrap" };
const balanceStyle: CSSProperties = { fontSize: 15, lineHeight: 1, fontWeight: 650, fontVariantNumeric: "tabular-nums", color: "var(--text2)" };
const readyStyle = (negative: boolean): CSSProperties => ({ fontSize: 12, lineHeight: 1, color: negative ? "var(--danger)" : "var(--muted)" });
const emptyStyle: CSSProperties = { minHeight: 120, display: "grid", placeItems: "center", borderRadius: "var(--radius-card)", background: "var(--surface2)", color: "var(--muted)", fontSize: 13 };
