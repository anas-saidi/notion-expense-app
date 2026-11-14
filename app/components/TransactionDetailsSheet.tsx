"use client";

import { useState } from "react";

import { SheetBody, SheetHeader } from "./ui/SheetLayout";

import { UndoSavingsDeposit } from "./UndoSavingsDeposit";
import type { Account, Category, Transaction } from "./app-types";
import { fmtDate } from "./app-utils";
import { BottomSheet } from "./ui/BottomSheet";
import { XIcon } from "./ui/icons";
import { Money } from "./Money";
import { SavingCover, guardClose } from "./ui/SavingCover";

type Props = {
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onUndone: () => void | Promise<void>;
};

export function TransactionDetailsSheet({ transaction, accounts, categories, onClose, onUndone }: Props) {
  // The undo inside reports its delete here, so the whole sheet is covered and cannot close mid-write.
  const [undoing, setUndoing] = useState(false);
  if (!transaction) return null;
  const close = guardClose(undoing, onClose);
  const categoryName = (id: string | null | undefined) => categories.find(item => item.id === id)?.name ?? "Category unavailable";
  const accountName = (id: string | null | undefined) => accounts.find(item => item.id === id)?.label ?? "Account unavailable";
  const type = transaction.type ?? "Unknown";
  const relationships = type === "Transfer"
    ? transaction.fromCategoryId || transaction.toCategoryId
      ? `${categoryName(transaction.fromCategoryId)} → ${categoryName(transaction.toCategoryId)}`
      : `${accountName(transaction.fromAccountId)} → ${accountName(transaction.toAccountId)}`
    : type === "Income"
      ? `To ${accountName(transaction.toAccountId ?? transaction.accountId)}`
      : accountName(transaction.accountId);

  return (
    <BottomSheet open onClose={close} label={`${type} details`} detent="default" snapPoints={[0, 0.62, 1]} initialSnap={1} size="standard" panelStyle={{ background: "var(--surface)" }} contentStyle={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* Fixed header, one scrolling body (design.md, Sheet overflow). */}
      <SheetHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 24px 0" }}>
        <h2 style={{ margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600, color: "var(--text)" }}>{transaction.name || type}</h2>
        <button type="button" className="sheet-close-button" aria-label="Close transaction details" onClick={close}><XIcon size={20} /></button>
      </SheetHeader>
      <SheetBody style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "16px 24px 24px", display: "grid", alignContent: "start", gap: 24 }}>
        <strong style={detailAmountStyle}><Money value={transaction.amount} currency /></strong>
        <dl style={{ display: "grid", gap: 12, margin: 0 }}>
          {transaction.name && <Detail label="Type" value={type} />}
          <Detail label="Date" value={fmtDate(transaction.date)} />
          {type === "Expense" ? <><Detail label="Category" value={categoryName(transaction.category)} /><Detail label="Account" value={accountName(transaction.accountId)} /></> : <Detail label="Flow" value={relationships} />}
        </dl>
        {type === "Transfer" ? <UndoSavingsDeposit key={transaction.id} operationId={transaction.savingsFundingOperation} transactionId={transaction.id} onUndone={onUndone} onBusyChange={setUndoing} /> : type !== "Expense" && <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: "18px" }}>
          {`Editing is unavailable for this ${type.toLowerCase()}`}
        </p>}

      </SheetBody>
      <SavingCover saving={undoing} label="Deleting" />
    </BottomSheet>
  );
}

/** The detail sheets' one owning amount: 32/40 semibold, tabular, left-aligned under the title. */
const detailAmountStyle = { display: "block", fontSize: 32, lineHeight: "40px", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text)" } as const;

function Detail({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><dt style={{ color: "var(--muted)" }}>{label}</dt><dd style={{ margin: 0, textAlign: "right", color: "var(--text)" }}>{value}</dd></div>;
}
