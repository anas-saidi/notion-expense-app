"use client";

import type { Account, Category, Transaction } from "./app-types";
import { fmtDate } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { Money } from "./Money";

type Props = {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
};

export function TransactionDetailsSheet({ transaction, accounts, categories, onClose }: Props) {
  if (!transaction) return null;
  const categoryName = (id: string | null | undefined) => categories.find(item => item.id === id)?.name ?? "Unresolved category";
  const accountName = (id: string | null | undefined) => accounts.find(item => item.id === id)?.label ?? "Unresolved account";
  const type = transaction.type ?? "Unknown";
  const relationships = type === "Transfer"
    ? transaction.fromCategoryId || transaction.toCategoryId
      ? `${categoryName(transaction.fromCategoryId)} → ${categoryName(transaction.toCategoryId)}`
      : `${accountName(transaction.fromAccountId)} → ${accountName(transaction.toAccountId)}`
    : type === "Income"
      ? `To ${accountName(transaction.toAccountId ?? transaction.accountId)}`
      : `${categoryName(transaction.category)} · ${accountName(transaction.accountId)}`;

  return (
    <BottomSheet open onClose={onClose} label={`${type} details`} detent="default" snapPoints={[0, 0.62, 1]} initialSnap={1} maxWidth="500px" panelStyle={{ background: "var(--surface)", overflowY: "auto" }}>
      <div style={{ padding: "8px 20px 28px", display: "grid", gap: 20 }}>
        <header>
          <p className="section-label" style={{ marginBottom: 8 }}>{type}</p>
          <h2 style={{ fontSize: 24, lineHeight: 1.15 }}>{transaction.name || type}</h2>
          <strong style={{ display: "block", marginTop: 12, fontSize: 32, fontVariantNumeric: "tabular-nums" }}><Money value={transaction.amount} animated animateOnMount /></strong>
        </header>
        <dl style={{ display: "grid", gap: 12, margin: 0 }}>
          <Detail label="Date" value={fmtDate(transaction.date)} />
          <Detail label="Flow" value={relationships} />
        </dl>
        <p style={{ margin: 0, padding: 14, borderRadius: "var(--radius-control)", background: "var(--surface2)", color: "var(--text2)", fontSize: 14, lineHeight: 1.45 }}>
          {type === "Expense" ? "Expense details." : `Editing ${type.toLowerCase()} transactions is not available here. The original type and relationships are protected.`}
        </p>
        <button type="button" onClick={onClose} className="pressable" style={{ minHeight: 48, borderRadius: "var(--radius-control)", border: "1px solid var(--border2)", background: "var(--surface)", color: "var(--text)", fontWeight: 700 }}>Close</button>
      </div>
    </BottomSheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><dt style={{ color: "var(--muted)" }}>{label}</dt><dd style={{ margin: 0, textAlign: "right", color: "var(--text)" }}>{value}</dd></div>;
}
