"use client";

import { SheetHeader } from "./ui/SheetLayout";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Account, BudgetScope } from "./app-types";
import { assignableOf, scopeFromAccountLabel } from "./app-utils";
import { Money } from "./Money";
import { BottomSheet } from "./ui/BottomSheet";
import { XIcon } from "./ui/icons";
import { CategoryIcon } from "./ui/CategoryIcon";
import { EmptyState } from "./ui/EmptyState";
import { accountIconSource } from "../../lib/category-icons";

type ManageScreenProps = {
  accounts: Account[];
  budgetScope: BudgetScope;
  onClose: () => void;
  onOpenDetails: (account: Account) => void;
  /** Desktop: list on the left, the selected account in a pane on the right (`onDetailPane` receives it). */
  wide?: boolean;
  selectedId?: string | null;
  onDetailPane?: (pane: HTMLElement | null) => void;
};

export function ManageScreen({ accounts, budgetScope, onClose, onOpenDetails, wide = false, selectedId = null, onDetailPane }: ManageScreenProps) {
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

  // Wide: an account is always open beside the list. Keep the last one when a Move or Add income sheet
  // clears the selection, so returning lands where the user was.
  const lastSelected = useRef<string | null>(null);
  if (selectedId) lastSelected.current = selectedId;
  useEffect(() => {
    if (!wide || scopedAccounts.length === 0 || scopedAccounts.some(a => a.id === selectedId)) return;
    onOpenDetails(scopedAccounts.find(a => a.id === lastSelected.current) ?? scopedAccounts[0]);
  }, [wide, selectedId, scopedAccounts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BottomSheet
      open
      onClose={onClose}
      label="Accounts"
      size={wide ? "account" : "standard"}
      panelStyle={sheetStyle}
      contentStyle={sheetContentStyle}
    >
    <main className="manage-screen sheet-body" data-wide={wide || undefined} style={screenStyle}>
      <div className="manage-list-pane">
      <SheetHeader style={headerStyle}>
        <h1 style={titleStyle}>Accounts</h1>
        <button className="sheet-close-button" type="button" onClick={onClose} aria-label="Close accounts">
          <XIcon size={20} />
        </button>
      </SheetHeader>

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

      <section aria-label="Account list" style={accountsSectionStyle}>
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
                aria-current={wide && account.id === selectedId ? "true" : undefined}
                className="tx-row transaction-row manage-account-row"
                style={accountRowStyle}
              >
                <CategoryIcon icon={accountIconSource(account.type)} size={24} />
                <span style={accountCopyStyle}>
                  <span style={rowTitleStyle}>{account.label}</span>
                  {account.type && <span style={rowMetaStyle}>{account.type}</span>}
                </span>
                <span style={amountStackStyle}>
                  <span style={balanceStyle}><Money value={account.balance ?? 0} /></span>
                  {Math.abs(assignableOf(account) ?? 0) >= 0.005 && (
                    <span style={readyStyle((assignableOf(account) ?? 0) < 0)}>
                      Unassigned <Money value={assignableOf(account) ?? 0} />
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState minHeight={120}>No accounts in this wallet.</EmptyState>
        )}
      </section>
      </div>
      {wide && <section ref={onDetailPane} className="manage-detail-pane" aria-label="Selected account" />}
    </main>
    </BottomSheet>
  );
}

const screenStyle: CSSProperties = {
  width: "100%",
  margin: "0 auto",
  padding: "16px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  display: "grid",
  alignContent: "start",
  gap: 24,
};

const sheetStyle: CSSProperties = { borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0" };
const sheetContentStyle: CSSProperties = { overflowX: "hidden" };

const headerStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const titleStyle: CSSProperties = { margin: 0, fontFamily: "var(--font-body)", fontSize: 20, lineHeight: "24px", fontWeight: 600, color: "var(--text)" };
const heroStyle: CSSProperties = { display: "grid", justifyItems: "center", gap: 8, padding: "16px 0 8px", textAlign: "center" };
const heroLabelStyle: CSSProperties = { fontSize: 13, lineHeight: "16px", fontWeight: 600, color: "var(--muted)" };
const heroAmountStyle: CSSProperties = { display: "inline-flex", justifyContent: "center", fontFamily: "var(--font-body)", fontSize: 34, lineHeight: "40px", fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap" };

// Passive metadata, so plain text (not a pill); danger only when negative.
const readyMetricStyle = (negative: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "baseline", gap: 4,
  color: negative ? "var(--danger)" : "var(--text2)", fontSize: 13, lineHeight: "16px", fontWeight: 600,
});

const accountsSectionStyle: CSSProperties = { display: "grid", gap: 12 };
const listStyle: CSSProperties = { display: "grid" };

// Mirrors ui/TransactionRow so account rows read like every other list in the app.
const accountRowStyle: CSSProperties = { width: "100%", minHeight: 64, padding: "12px 0", border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" };
const accountCopyStyle: CSSProperties = { flex: 1, minWidth: 0, display: "grid", gap: 4 };
const rowTitleStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, lineHeight: 1.2, fontWeight: 500, color: "var(--text2)" };
const rowMetaStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, lineHeight: 1.2, color: "var(--muted)" };
const amountStackStyle: CSSProperties = { display: "grid", justifyItems: "end", gap: 4, flexShrink: 0, whiteSpace: "nowrap" };
const balanceStyle: CSSProperties = { fontSize: 15, lineHeight: 1, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text2)" };
const readyStyle = (negative: boolean): CSSProperties => ({ fontSize: 12, lineHeight: 1, color: negative ? "var(--danger)" : "var(--muted)" });
