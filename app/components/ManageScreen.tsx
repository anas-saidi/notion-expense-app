"use client";

import { useMemo, type CSSProperties } from "react";
import type { Account, BudgetScope } from "./app-types";
import { scopeFromAccountLabel } from "./app-utils";
import { Money } from "./Money";
import { BottomSheet } from "./ui/BottomSheet";
import { ChevronRightIcon, XIcon } from "./ui/icons";

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
    ready: scopedAccounts.reduce((sum, account) => sum + (account.readyToAssign ?? 0), 0),
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
          <Money value={totals.balance} animated animateOnMount />
        </strong>
        <span style={readyMetricStyle(totals.ready < 0)}>
          <span>Ready to assign</span>
          <strong><Money value={totals.ready} /></strong>
        </span>
      </section>

      <section aria-labelledby="account-list-heading" style={accountsSectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 id="account-list-heading" style={sectionTitleStyle}>Your accounts</h2>
          <span style={accountCountStyle}>{scopedAccounts.length}</span>
        </div>

        {scopedAccounts.length > 0 ? (
          <div className="manage-account-list" style={listSurfaceStyle}>
            {scopedAccounts.map((account, index) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onOpenDetails(account)}
                aria-label={`View ${account.label} details`}
                className="manage-account-row"
                style={{ ...accountRowStyle, borderTop: index === 0 ? "none" : "1px solid var(--border)" }}
              >
                <span style={accountIconStyle} aria-hidden="true">{account.icon}</span>
                <span style={accountCopyStyle}>
                  <strong style={rowTitleStyle}>{account.label}</strong>
                  <span style={rowMetaStyle}>{account.type ?? "Account"}</span>
                </span>
                <span style={amountStackStyle}>
                  <strong style={balanceStyle}><Money value={account.balance ?? 0} /></strong>
                  <span style={readyStyle((account.readyToAssign ?? 0) < 0)}>
                    Ready <Money value={account.readyToAssign ?? 0} />
                  </span>
                </span>
                <ChevronRightIcon size={16} aria-hidden="true" style={{ color: "var(--muted)" }} />
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
  background: negative ? "color-mix(in srgb, var(--danger) 10%, var(--surface))" : "var(--accent-dim)",
  color: negative ? "var(--danger)" : "var(--accent-ink)", fontSize: 12, fontWeight: 650,
});

const accountsSectionStyle: CSSProperties = { display: "grid", gap: 12 };
const sectionHeaderStyle: CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.2, fontWeight: 750, color: "var(--text)" };
const accountCountStyle: CSSProperties = { minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, background: "var(--surface2)", color: "var(--text2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 };
const listSurfaceStyle: CSSProperties = { overflow: "hidden", borderRadius: "var(--radius-card)", background: "var(--surface)", boxShadow: "var(--elevation-card)" };

const accountRowStyle: CSSProperties = {
  width: "calc(100% - 16px)", minHeight: 76, margin: "0 8px", padding: "12px 4px", borderRight: "none", borderBottom: "none", borderLeft: "none",
  background: "transparent", color: "var(--text)", display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto 16px", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer",
};

const accountIconStyle: CSSProperties = { width: 44, height: 44, borderRadius: "var(--radius-control)", background: "var(--surface2)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const accountCopyStyle: CSSProperties = { minWidth: 0, display: "grid", gap: 4 };
const rowTitleStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, lineHeight: 1.2, fontWeight: 700, color: "var(--text)" };
const rowMetaStyle: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, lineHeight: 1.2, color: "var(--muted)" };
const amountStackStyle: CSSProperties = { display: "grid", gap: 4, justifyItems: "end", minWidth: 0, whiteSpace: "nowrap" };
const balanceStyle: CSSProperties = { fontSize: 14, lineHeight: 1.1, fontWeight: 750, color: "var(--text2)" };
const readyStyle = (negative: boolean): CSSProperties => ({ fontSize: 12, lineHeight: 1.1, color: negative ? "var(--danger)" : "var(--muted)" });
const emptyStyle: CSSProperties = { minHeight: 120, display: "grid", placeItems: "center", borderRadius: "var(--radius-card)", background: "var(--surface2)", color: "var(--muted)", fontSize: 13 };
