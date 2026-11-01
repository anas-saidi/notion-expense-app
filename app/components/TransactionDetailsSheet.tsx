"use client";

import { SheetBody, SheetHeader } from "./ui/SheetLayout";

import { UndoSavingsDeposit } from "./UndoSavingsDeposit";
import type { Account, Category, Transaction } from "./app-types";
import { fmtDate } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { XIcon } from "./ui/icons";
import { Money } from "./Money";

type Props = {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onUndone: () => void | Promise<void>;
};

export function TransactionDetailsSheet({ transaction, accounts, categories, onClose, onUndone }: Props) {
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
      : accountName(transaction.accountId);

  return (
    <BottomSheet open onClose={onClose} label={`${type} details`} detent="default" snapPoints={[0, 0.62, 1]} initialSnap={1} size="standard" panelStyle={{ background: "var(--surface)", overflowY: "auto" }}>
      <SheetBody style={{ padding: "8px 20px 28px", display: "grid", gap: 20 }}>
        <SheetHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.15 }}>{transaction.name || type}</h2>
          <button type="button" className="sheet-close-button" aria-label="Close transaction details" onClick={onClose}><XIcon size={20} /></button>
        </SheetHeader>
        <strong style={{ display: "block", fontSize: 32, fontVariantNumeric: "tabular-nums" }}><Money value={transaction.amount} currency animated animateOnMount /></strong>
        <dl style={{ display: "grid", gap: 12, margin: 0 }}>
          <Detail label="Type" value={type} />
          <Detail label="Date" value={fmtDate(transaction.date)} />
          {type === "Expense" ? <><Detail label="Category" value={categoryName(transaction.category)} /><Detail label="Account" value={accountName(transaction.accountId)} /></> : <Detail label="Flow" value={relationships} />}
        </dl>
        {type === "Transfer" ? <UndoSavingsDeposit key={transaction.id} operationId={transaction.savingsFundingOperation} transactionId={transaction.id} onUndone={onUndone} /> : <p style={{ margin: 0, padding: 14, borderRadius: "var(--radius-control)", background: "var(--surface2)", color: "var(--text2)", fontSize: 14, lineHeight: 1.45 }}>
          {type === "Expense" ? "Expense details." : `Editing ${type.toLowerCase()} transactions is not available here. The original type and relationships are protected.`}
        </p>}

      </SheetBody>
    </BottomSheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><dt style={{ color: "var(--muted)" }}>{label}</dt><dd style={{ margin: 0, textAlign: "right", color: "var(--text)" }}>{value}</dd></div>;
}
